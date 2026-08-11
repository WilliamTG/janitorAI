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
from doc_engine import replace_text_in_doc, upload_and_insert_image
from prompt import system_prompt, main_prompt, build_inspector_context
from template_replacement import build_replacements

TEMP_PHOTO_DIR = "./temp_photos"


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
    Returns a list of successfully uploaded Gemini file objects.
    """
    uploaded = []
    notes = project.get("notes") or []
    for note in notes:
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

            try:
                print(f"📸 Downloading inspector photo: {url.split('?')[0]} ...")
                resp = _requests.get(url, timeout=30)
                resp.raise_for_status()

                content_type = resp.headers.get("Content-Type", "image/jpeg").split(";")[0].strip()
                suffix = ".jpg" if "jpeg" in content_type else ".png" if "png" in content_type else ".jpg"

                os.makedirs(TEMP_PHOTO_DIR, exist_ok=True)
                fd, tmp_path = tempfile.mkstemp(dir=TEMP_PHOTO_DIR, suffix=suffix)
                try:
                    with os.fdopen(fd, "wb") as f:
                        f.write(resp.content)
                    photo_file = genai_client.files.upload(file=tmp_path)
                    while photo_file.state.name == "PROCESSING":
                        time.sleep(1)
                        photo_file = genai_client.files.get(name=photo_file.name)
                    uploaded.append(photo_file)
                    print(f"✅ Inspector photo uploaded to Gemini: {photo_file.name}")
                finally:
                    try:
                        os.unlink(tmp_path)
                    except OSError:
                        pass
            except Exception as exc:
                print(f"⚠️  Skipping inspector photo (fetch/upload failed): {exc}")
    return uploaded


def create_report(video_path, master_id, output_folder, gemini_key, report_meta: dict | None = None, project: dict | None = None, tester_email: str | None = None):
    # 1. Init Connections
    docs, drive = connect_to_google_api_personal()
    genai_client = genai.Client(api_key=gemini_key)

    # 2. Gemini Analysis (Multimodal)
    print("🤖 Gemini is analyzing video...")
    video_file = genai_client.files.upload(file=video_path)
    while video_file.state.name == "PROCESSING":
        time.sleep(2)
        video_file = genai_client.files.get(name=video_file.name)

    # Upload inspector photos (if any) so Gemini can analyse them alongside the video
    photo_files = []
    if project:
        photo_files = _upload_inspector_photos(genai_client, project)
        if photo_files:
            print(f"📸 {len(photo_files)} inspector photo(s) ready for Gemini")
    
    current_dir = os.path.dirname(os.path.abspath(__file__))
    knowledge_path = os.path.join(current_dir, "temp_knowledge")
    
    if not os.path.exists(knowledge_path):
        knowledge_path = os.path.join(current_dir, "knowlegde")

    print(f"📚 Opplasting av kunnskapsbase fra: {knowledge_path}")
    knowledge_files = upload_knowledge_base(genai_client, knowledge_path)

    # Build contents: video → inspector photos → knowledge base → context prompt → analysis prompt
    context_text = build_inspector_context(project or {})
    context_parts = [context_text] if context_text else []

    contents = [video_file] + photo_files + knowledge_files + context_parts + [main_prompt()]

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
                "seed": 42}
    )
    analysis = gemini_response.parsed

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

    # Free memory after analysis - contents list can be large
    del contents, knowledge_files, video_file, photo_files
    gc.collect()
    print("🧹 Cleared analysis objects from memory")

    # 3. Create Doc Copy
    copy_name = f"Rapport_Skade_{int(time.time())}"
    new_doc = drive.files().copy(fileId=master_id, 
                                 supportsAllDrives=True,
                                 body={'name': copy_name, 'parents': [output_folder]}).execute()
    doc_id = new_doc['id']

    # 4. Process Evidence Image (memory-optimized with aggressive cleanup)
    if analysis.evidence_points and len(analysis.evidence_points) > 0:
        # Pick the timestamp Gemini identified as the best evidence
        best_point = analysis.evidence_points[0]
        print(f"📸 Extracting frame at {best_point.timestamp_ms}ms: {best_point.caption}")

        cap = None
        frame = None
        try:
            cap = cv2.VideoCapture(video_path)
            cap.set(cv2.CAP_PROP_POS_MSEC, best_point.timestamp_ms)
            ret, frame = cap.read()

            if ret and frame is not None:
                cv2.imwrite("evidence.jpg", frame)
                print("💾 Frame saved to evidence.jpg")

                # Free frame memory immediately
                del frame
                frame = None

                upload_and_insert_image(drive, docs, doc_id, "evidence.jpg", "{{damage.cause.picture}}", output_folder)
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

            # Force garbage collection to free OpenCV buffers
            gc.collect()
            print("🧹 Released video capture and frame buffers")
    else:
        print("⚠️ Ingen bevis-tidspunkter funnet av Gemini. Hopper over bildeekstraksjon.")

    # 5. Final Text Replacement (Gemini + project metadata)
    replacements = build_replacements(report_meta or {})
    
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

    # 6. Share the document with the tester's email (if provided)
    if tester_email and tester_email.strip():
        try:
            share_doc_with_email(drive, doc_id, tester_email.strip(), role='reader')
        except Exception as e:
            # Non-fatal: log and continue — report was still generated successfully
            print(f"⚠️  Could not share doc with {tester_email}: {e}")

    print(f"✅ Pipeline Complete: https://docs.google.com/document/d/{doc_id}")
    # A5 (versjonslagring): den strukturerte analysen returneres sammen med
    # dokument-ID-en slik at API/app kan lagre AI-utkastet som egen versjon —
    # ikke bare det ferdig flettede dokumentet. token_usage gir COGS-måling.
    return doc_id, analysis, token_usage