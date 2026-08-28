import os
import cv2
import time
import gc
import tempfile
import requests as _requests
from urllib.parse import urlparse as _urlparse
from google import genai
from models import DamageAnalysis
from google_api import connect_to_google_api_personal, upload_knowledge_base, share_doc_with_email
from doc_engine import replace_text_in_doc, upload_and_insert_image, insert_photo_gallery
from prompt import system_prompt, main_prompt, build_inspector_context
from template_replacement import build_replacements

TEMP_PHOTO_DIR = "./temp_photos"


class ReportPipelineError(Exception):
    """
    Feil ETTER Gemini-analysen (fletting/galleri/deling): analysen er allerede
    fakturert, så unntaket bærer token_usage videre til API-et (COGS for
    feilede kjøringer), og doc_id for en halvferdig dokumentkopi som ikke lot
    seg rydde bort — den skal aldri bli liggende sporløst i Drive.
    """

    def __init__(self, message, token_usage=None, doc_id=None):
        super().__init__(message)
        self.token_usage = token_usage
        self.doc_id = doc_id


def _validate_media_url(url: str) -> None:
    """
    Validates that a URL is a safe, expected media endpoint before fetching.
    Mirrors the same checks as _validate_video_url in server.py to prevent SSRF:
    - Scheme must be http or https
    - Path must match /api/media/<id>
    - Host must match API_BASE_URL when configured
    Raises ValueError with a descriptive message on any violation.
    """
    parsed = _urlparse(url)

    if parsed.scheme not in ("http", "https"):
        raise ValueError(f"Invalid URL scheme '{parsed.scheme}' — only http/https allowed")

    path_parts = parsed.path.strip("/").split("/")
    if len(path_parts) < 3 or path_parts[0] != "api" or path_parts[1] != "media":
        raise ValueError(
            f"URL path '{parsed.path}' does not match expected /api/media/<id> pattern"
        )

    api_base = os.getenv("API_BASE_URL", "").rstrip("/")
    if api_base:
        expected = _urlparse(api_base)
        if parsed.netloc != expected.netloc:
            raise ValueError(
                f"URL host '{parsed.netloc}' does not match configured API host '{expected.netloc}'"
            )


def _upload_inspector_photos(genai_client, project: dict) -> list:
    """
    Downloads each inspector photo (URL already contains auth token) and
    uploads it to the Gemini Files API so Gemini can actually see the images.

    Each URL is validated against the same allowlist used for the video URL
    (scheme, /api/media/<id> path, host pinning) to prevent SSRF.

    Skips individual photos that fail validation or download with a logged
    warning; other photos in the same request are still attempted.

    Returns a list of records {'file': gemini_file, 'path': local_tmp_path,
    'room': str, 'caption': str} in capture order. The local copies are KEPT
    (needed later for the report's evidence image and photo gallery) — the
    caller is responsible for calling _cleanup_photo_files() when done.
    """
    records = []
    notes = project.get("notes") or []
    for note in notes:
        room = (note.get("room") or "").strip()
        for photo in (note.get("photos") or []):
            url = (photo.get("uri") or "").strip()
            if not url:
                continue

            # Validate before any network I/O
            try:
                _validate_media_url(url)
            except ValueError as ve:
                print(f"⛔ Rejected inspector photo URL (SSRF guard): {ve}")
                continue  # skip this photo; do not fetch

            tmp_path = None
            try:
                print(f"📸 Downloading inspector photo: {url.split('?')[0]} ...")
                resp = _requests.get(url, timeout=30)
                resp.raise_for_status()

                content_type = resp.headers.get("Content-Type", "image/jpeg").split(";")[0].strip()
                suffix = ".jpg" if "jpeg" in content_type else ".png" if "png" in content_type else ".jpg"

                os.makedirs(TEMP_PHOTO_DIR, exist_ok=True)
                fd, tmp_path = tempfile.mkstemp(dir=TEMP_PHOTO_DIR, suffix=suffix)
                with os.fdopen(fd, "wb") as f:
                    f.write(resp.content)
                photo_file = genai_client.files.upload(file=tmp_path)
                # Denial-of-Wallet-vern: bind ventingen (som videostien),
                # ellers kan et foto som henger i PROCESSING låse jobben.
                photo_deadline = time.monotonic() + 120  # maks 2 min
                while photo_file.state.name == "PROCESSING":
                    if time.monotonic() > photo_deadline:
                        raise TimeoutError("Gemini foto-prosessering tok for lang tid (>2 min)")
                    time.sleep(1)
                    photo_file = genai_client.files.get(name=photo_file.name)
                if photo_file.state.name == "FAILED":
                    raise RuntimeError("Gemini klarte ikke å prosessere inspektørfotoet")
                records.append({
                    "file": photo_file,
                    "path": tmp_path,
                    "room": room,
                    "caption": (photo.get("caption") or "").strip(),
                })
                print(f"✅ Inspector photo uploaded to Gemini: {photo_file.name}")
            except Exception as exc:
                print(f"⚠️  Skipping inspector photo (fetch/upload failed): {exc}")
                if tmp_path:
                    try:
                        os.unlink(tmp_path)
                    except OSError:
                        pass
    return records


def _cleanup_photo_files(photo_records: list) -> None:
    """Deletes the local temp copies kept by _upload_inspector_photos."""
    for rec in photo_records:
        try:
            os.unlink(rec["path"])
        except OSError:
            pass


def _photo_manifest(photo_records: list) -> str:
    """
    Numbered photo list for the prompt. The numbering (1-based, upload order)
    is the ONLY numbering source_photo_index may reference — kildekobling:
    hvert bevispunkt skal peke på fotoet som faktisk viser det.
    """
    if not photo_records:
        return ""
    lines = ["### VEDLAGTE FOTO (nummerert — bruk disse numrene i source_photo_index)"]
    for i, rec in enumerate(photo_records, 1):
        parts = [f"Foto {i}"]
        if rec["room"]:
            parts.append(f"(rom: {rec['room']})")
        if rec["caption"]:
            parts.append(f"— {rec['caption']}")
        lines.append(" ".join(parts))
    return "\n".join(lines)


def create_report(video_path: str | None, master_id, output_folder, gemini_key, report_meta: dict | None = None, project: dict | None = None, tester_email: str | None = None):
    # 1. Init Connections
    docs, drive = connect_to_google_api_personal()
    genai_client = genai.Client(api_key=gemini_key)

    # 2. Gemini Analysis (multimodal). Video is useful evidence when present,
    # but reports must also work from notes, transcriptions, photos, and metadata.
    video_file = None
    if video_path:
        print("🤖 Gemini is analyzing available video evidence...")
        video_file = genai_client.files.upload(file=video_path)
        # Denial-of-Wallet-vern: bind ventingen på videoprosessering (ellers kan en
        # fil som henger i PROCESSING holde en fakturerbar jobb åpen i det uendelige).
        video_deadline = time.monotonic() + 300  # maks 5 min
        while video_file.state.name == "PROCESSING":
            if time.monotonic() > video_deadline:
                raise TimeoutError("Gemini video-prosessering tok for lang tid (>5 min)")
            time.sleep(2)
            video_file = genai_client.files.get(name=video_file.name)
        if video_file.state.name == "FAILED":
            raise RuntimeError("Gemini klarte ikke å prosessere videoen")

    # Upload inspector photos (if any) so Gemini can analyse them with every
    # other available inspection source. Local copies are kept for the report's
    # evidence image + photo gallery and cleaned up at the end.
    photo_records = []
    if project:
        photo_records = _upload_inspector_photos(genai_client, project)
        if photo_records:
            print(f"📸 {len(photo_records)} inspector photo(s) ready for Gemini")
    photo_files = [rec["file"] for rec in photo_records]

    # Feiler noe i analysefasen (kunnskapsopplasting, Gemini-kallet,
    # valideringen), skal de lokale fotokopiene ikke bli liggende igjen i
    # temp-katalogen — unntaket propagerer ellers uendret som før.
    try:
        current_dir = os.path.dirname(os.path.abspath(__file__))
        knowledge_path = os.path.join(current_dir, "temp_knowledge")

        if not os.path.exists(knowledge_path):
            knowledge_path = os.path.join(current_dir, "knowlegde")

        print(f"📚 Opplasting av kunnskapsbase fra: {knowledge_path}")
        knowledge_files = upload_knowledge_base(genai_client, knowledge_path)

        # Build contents from every available source. No evidence type has an
        # automatic priority; Gemini reconciles the supplied material.
        # report_meta (building year, inspection date) feeds the deterministic
        # case-signal block computed in build_case_signals() — see
        # docs/ARCHITECTURE_WATER_DAMAGE_TREE.md §3.6/steg 0.
        context_text = build_inspector_context(project or {}, report_meta)
        context_parts = [context_text] if context_text else []
        manifest = _photo_manifest(photo_records)
        if manifest:
            context_parts.append(manifest)

        contents = (
            ([video_file] if video_file else [])
            + photo_files
            + knowledge_files
            + context_parts
            + [main_prompt()]
        )

        print("🧠 Sending content to Gemini for analysis...")
        gemini_response = genai_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents,
            config={"response_mime_type": "application/json",
                    "response_schema": DamageAnalysis,
                    "system_instruction": system_prompt(),
                    "temperature": 0.0,    # Setter kreativiteten til null
                    "top_p": 0.1,         # Velger kun de mest sannsynlige ordene
                    "top_k": 1,           # Velger kun det aller beste ordet for hvert steg
                    "seed": 42,
                    # Denial-of-Wallet-vern: hard timeout (ms) på selve analysekallet —
                    # den største og tidligere ubundne kostnadsdriveren.
                    "http_options": {"timeout": 120000}}
        )
        analysis = gemini_response.parsed

        # Sitatport: «Byggforsk-henvisninger vises kun med verifisert punktnummer».
        # Alt modellen siterer valideres mot metadata-indeksen; uverifiserte
        # referanser forkastes fremfor å nå rapporten (anti-hallusinering).
        from byggforsk_index import valider_referanse
        if analysis and analysis.evidence_points:
            for punkt in analysis.evidence_points:
                original = punkt.technical_reference
                verifisert = valider_referanse(original)
                if original and not verifisert:
                    print(f"⚠️  Forkastet uverifisert Byggforsk-referanse: {original!r}")
                punkt.technical_reference = verifisert
    except Exception:
        _cleanup_photo_files(photo_records)
        raise

    # COGS: fang tokenforbruk fra rå-responsen før den forkastes, så backend kan
    # måle faktisk kostnad per rapport (docs/prising-bruksbasert.md).
    token_usage = None
    usage = getattr(gemini_response, "usage_metadata", None)
    if usage is not None:
        token_usage = {
            "model": "gemini-2.5-flash",
            "input_tokens": getattr(usage, "prompt_token_count", None),
            "output_tokens": getattr(usage, "candidates_token_count", None),
            "total_tokens": getattr(usage, "total_token_count", None),
        }

    # Free memory after analysis - contents list can be large.
    # photo_records beholdes: de lokale kopiene brukes til bevisbilde/galleri.
    del contents, knowledge_files, video_file, photo_files
    gc.collect()
    print("🧹 Cleared analysis objects from memory")

    # 3–6 kjører i én try: feiler noe ETTER at dokumentkopien er laget, skal
    # (a) den halvferdige kopien slettes fra Drive (ellers ligger den igjen og
    # kan forveksles med en ekte rapport), og (b) token_usage følge unntaket
    # videre — analysen er fakturert selv om rapporten aldri ble ferdig.
    doc_id = None
    try:
        # 3. Create Doc Copy
        copy_name = f"Rapport_Skade_{int(time.time())}"
        new_doc = drive.files().copy(fileId=master_id,
                                     supportsAllDrives=True,
                                     body={'name': copy_name, 'parents': [output_folder]}).execute()
        doc_id = new_doc['id']

        # 4. Process Evidence Image (memory-optimized with aggressive cleanup)
        evidence_points = (analysis.evidence_points if analysis and analysis.evidence_points else [])
        if video_path and len(evidence_points) > 0:
            # Pick the timestamp Gemini identified as the best evidence
            best_point = analysis.evidence_points[0]
            print(f"📸 Extracting frame at {best_point.timestamp_ms}ms: {best_point.caption}")

            cap = None
            frame = None
            evidence_path = None
            try:
                cap = cv2.VideoCapture(video_path)
                cap.set(cv2.CAP_PROP_POS_MSEC, best_point.timestamp_ms)
                ret, frame = cap.read()

                if ret and frame is not None:
                    # Per-kjøring-unik fil, ALDRI en fast delt sti: motoren
                    # kjører nå flertrådet, og med en delt «evidence.jpg» kunne
                    # to samtidige kjøringer overskrive hverandres bevisbilde —
                    # feil skades bilde i feil rapport, på tvers av testere.
                    # (.jpg-suffiks kreves så OpenCV velger JPEG-enkoderen;
                    # fd-en lukkes fordi imwrite åpner via sti.)
                    os.makedirs(TEMP_PHOTO_DIR, exist_ok=True)
                    fd, evidence_path = tempfile.mkstemp(dir=TEMP_PHOTO_DIR, suffix=".jpg")
                    os.close(fd)
                    cv2.imwrite(evidence_path, frame)
                    print(f"💾 Frame saved to {evidence_path}")

                    # Free frame memory immediately
                    del frame
                    frame = None

                    upload_and_insert_image(drive, docs, doc_id, evidence_path, "{{damage.cause.picture}}", output_folder)
                else:
                    print("⚠️ Failed to extract frame from video")
            finally:
                # Ensure video capture is always released
                if cap is not None:
                    cap.release()
                    del cap

                # Delete frame if it still exists
                if frame is not None:
                    del frame

                if evidence_path is not None:
                    try:
                        os.unlink(evidence_path)
                    except OSError:
                        pass

                # Force garbage collection to free OpenCV buffers
                gc.collect()
                print("🧹 Released video capture and frame buffers")
        elif photo_records and len(evidence_points) > 0:
            # Pilotfunn: uten video sto {{damage.cause.picture}} igjen som rå
            # plassholder i rapporten. Bruk fotoet modellen selv pekte ut som
            # beste bevis (source_photo_index fra manifestet); fall tilbake til
            # første foto når indeksen mangler eller er ugyldig.
            chosen = photo_records[0]
            idx = getattr(evidence_points[0], "source_photo_index", None)
            if isinstance(idx, int) and 1 <= idx <= len(photo_records):
                chosen = photo_records[idx - 1]
            print(f"📸 Ingen video — bruker inspektørfoto som bevisbilde: {chosen['path']}")
            try:
                upload_and_insert_image(drive, docs, doc_id, chosen["path"], "{{damage.cause.picture}}", output_folder)
            except Exception as exc:
                print(f"⚠️  Kunne ikke sette inn bevisbilde fra foto: {exc}")
        else:
            print("ℹ️ Ingen video- eller fotobevis å bruke som bevisbilde.")

        # 5. Final Text Replacement (Gemini + project metadata)
        replacements = build_replacements(report_meta or {})

        # Sikkerhetsnett: hvis bildeinnsettingen over lyktes, er plassholderen
        # allerede borte og denne erstatningen er en no-op. Hvis den feilet eller
        # ingen bevis fantes, skal LESEREN aldri se en rå mal-plassholder.
        replacements["{{damage.cause.picture}}"] = (
            "Se «Bilder av stedet»." if photo_records else "—"
        )

        replacements.update({
            "{{damage.cause.area}}": analysis.area,
            "{{damage.cause.source}}": analysis.source,
            "{{damage.cause.cause}}": analysis.cause,
            "{{damage.cause.description}}": analysis.description,
            # Checkbox logic
            "{{habitable.is_habitable}}": f"Beboelighet: {'☒ Ja' if analysis.is_habitable else '☐ Ja'} {'☒ Nei' if not analysis.is_habitable else '☐ Nei'}",
            "{{damage.extent.description}}": analysis.extent_description,
            "{{damage.repairs_needed.description}}": analysis.repairs_description
        })
        replace_text_in_doc(docs, doc_id, replacements)

        # 5b. Bildegalleri: ALLE inspektørfoto inn under «Bilder av stedet», i
        # opptaksrekkefølge med rom/bildetekst. Pilotfunn: seksjonen sto tom og
        # testeren kunne ikke se hvilke bilder som faktisk var med i grunnlaget.
        if photo_records:
            gallery = []
            for i, rec in enumerate(photo_records, 1):
                label_parts = [f"Foto {i}"]
                if rec["room"]:
                    label_parts.append(f"— {rec['room']}")
                if rec["caption"]:
                    label_parts.append(f": {rec['caption']}")
                gallery.append({"path": rec["path"], "label": " ".join(label_parts)})
            try:
                insert_photo_gallery(drive, docs, doc_id, gallery, "Bilder av stedet", output_folder)
                print(f"🖼️  Satte inn {len(gallery)} foto under «Bilder av stedet»")
            except Exception as exc:
                print(f"⚠️  Kunne ikke sette inn bildegalleri: {exc}")

        _cleanup_photo_files(photo_records)

        # 6. Share the document with the tester's email (if provided)
        if tester_email and tester_email.strip():
            try:
                share_doc_with_email(drive, doc_id, tester_email.strip(), role='reader')
            except Exception as e:
                # Non-fatal: log and continue — report was still generated successfully
                print(f"⚠️  Could not share doc with {tester_email}: {e}")
    except Exception as exc:
        _cleanup_photo_files(photo_records)
        orphaned_doc_id = None
        if doc_id:
            try:
                drive.files().delete(fileId=doc_id, supportsAllDrives=True).execute()
                print(f"🧹 Slettet halvferdig dokumentkopi {doc_id} etter pipelinefeil")
            except Exception as del_exc:
                orphaned_doc_id = doc_id
                print(f"⚠️  Fikk ikke slettet halvferdig dokumentkopi {doc_id}: {del_exc}")
        raise ReportPipelineError(str(exc), token_usage=token_usage, doc_id=orphaned_doc_id) from exc

    print(f"✅ Pipeline Complete: https://docs.google.com/document/d/{doc_id}")
    # A5 (versjonslagring): den strukturerte analysen returneres sammen med
    # dokument-ID-en slik at API/app kan lagre AI-utkastet som egen versjon —
    # ikke bare det ferdig flettede dokumentet. token_usage gir COGS-måling.
    return doc_id, analysis, token_usage