#!/usr/bin/env python3
"""
wer_benchmark.py — WER på ekte feltlyd: måler transkripsjonen mot en hånd-
transkribert fasit, totalt og på fagtermer.

Bakgrunn i docs/taleteknologi-laerdommer.md. Kort: generiske modeller er trent
på svært lite norsk (Whisper: 266 t av 680 000 t), feilene konsentrerer seg i
fagord, og ingen har målt hvor god transkripsjonen vår faktisk er på det
takstfolk sier i en kjeller. Dette skriptet gir tallet — og viser HVILKE ord
som går galt, så feilene kan sammenlignes med politiets sju feiltyper.

Prinsipp: motoren «docrai» kaller det KJØRENDE API-ets /transcribe — samme
prompt, samme modell, samme etterbehandling som appen. Vi måler produktet,
ikke en kopi av det. Andre motorer (NB-Whisper lokalt, eller hva som helst
via tekstfiler) sammenlignes på nøyaktig samme klipp og samme fasit.

Bruk:
  python3 wer_benchmark.py --selftest                 # verifiser regnestykket
  python3 wer_benchmark.py --init wer/                # mappestruktur + eksempler
  # legg klipp i wer/clips/, skriv fasit i wer/refs/<id>.txt, rediger manifest
  DOCRAI_API_URL=http://localhost:3000 TESTER_TOKEN=... \\
    python3 wer_benchmark.py wer/manifest.json --engine docrai
  python3 wer_benchmark.py wer/manifest.json --engine nb-whisper
  python3 wer_benchmark.py wer/manifest.json --engine file --label azure

Hypoteser caches i <manifest-mappe>/hyp/<label>/<id>.txt, så et API-kall
gjøres én gang per klipp. Slett fila for å kjøre på nytt.

Fasit-regler (avgjør om tallet betyr noe):
  - Skriv det som ble SAGT. Nøling («eh», «ehm») utelates; selvretting
    beholdes slik den ble sagt.
  - Tall med siffer («15 millimeter», «78 prosent») — slik prompten ber om.
  - Stillhetsklipp: tom fasit + "silence": true. Alt motoren produserer der
    er hallusinert og telles for seg — stillhetsklipp inngår IKKE i total-WER.
  - Klipp uten fasit (og uten "silence") hoppes over og listes som «mangler
    fasit» — de teller aldri stille med i totalen.
  - Bindestrek normaliseres til mellomrom, så «rør-i-rør» og «rør i rør» er
    like; fagtermene normaliseres med samme regel.
  - «%» blir «prosent», og enhetsforkortelsene mm/cm/m2 blir millimeter/
    centimeter/kvadratmeter på BEGGE sider — Gemini skriver gjerne «18,5 %»
    der fasit-regelen sier «18,5 prosent», og det er ikke en transkripsjonsfeil.
  - Fagtermer telles også i bøyd form: grunnform + valgfritt suffiks
    (-en/-et/-a/-er/-ene/-ane; for termer på -e: -n/-a/-r/-ne, så «dampsperra»
    og «sponplata» treffer; siste konsonant kan dobles: «kryperommet»). Skriv
    termene i entall («varmekabel», ikke «varmekabler»).
  - Fagterm-gjenfinning er FOREKOMSTVEKTET (mikro): et klipp med ti «sluk»
    veier ti ganger «klemring». Rapporten viser derfor også recall per term og
    et makro-gjennomsnitt — det er per-term-tabellen som avslører fagordet
    modellen konsekvent bommer på.
  - Tom hypotese på et taleklipp (tom cache-fil, motor som ga «» eller bare
    «…») hoppes over og listes; den scores aldri stille som 100 % WER.
  - Sammensetninger skrives sammen uten bindestrek («sponplate», ikke
    «spon-plate»); «rør-i-rør» er unntaket og normaliseres til mellomrom.
    Tall skrives uten tusenskille («1500», ikke «1 500») — skriptet slår
    likevel sammen «1 500» på begge sider. kvm/m2/m3 → kvadratmeter/kubikkmeter.
  - Makro-recall dekker bare termer som forekommer i fasit.
  - Exit-kode 2 når klipp er hoppet over: resultatet er da ikke hele settet,
    og JSON-en bærer clips_total / clips_scored / skipped_count.
  - "silence": true krever tom fasit; et klipp-id kan bare inneholde
    bokstaver, siffer, punktum, bindestrek og understrek, og må være unikt.
  - Fasit skrives av en fagperson. Om det heter «klemring» eller «klemmering»
    avgjør hele fagterm-tallet.

Motoren «docrai» og API-ets takst: /transcribe ligger bak heavyLimiter —
30 kall per 15 minutter per tester, delt med /describe-image og /report.
20–30 klipp kan trippe taket; ved 429 leses retryAfterSeconds, skriptet venter
og prøver én gang til. Et klipp som feiler i motoren stopper ikke kjøringen:
det listes under «Hoppet over» med feilteksten, og caches ikke. API-ets 500
«No transcription returned» godtas som tom hypotese KUN for stillhetsklipp;
for taleklipp kan det like gjerne være et blokkert Gemini-svar (SAFETY/
RECITATION), og da hoppes klippet over i stedet for å caches som 100 % WER.

WER = (S + D + I) / N, der N er antall ord i FASIT (ikke antall feil).
"""

import argparse
import json
import os
import re
import sys
from collections import Counter
from pathlib import Path

# Holdes manuelt i takt med TRANSCRIPTION_PROMPT i apps/api/src/index.js.
# Én term per element; flerordsuttrykk er ett element. Samme regel gjelder
# fagtermer.txt: én term per linje. Skriv --init og rediger for foretakets ord.
DEFAULT_FAGTERMER = [
    "sluk", "klemring", "membran", "smøremembran", "svill", "bunnsvill", "toppsvill",
    "diffusjonssperre", "dampsperre", "vindsperre", "fuktsperre", "grunnmurspapp",
    "drenering", "drensrør", "kapillærbrytende", "fuktskjold", "fuktmåling",
    "hulltaking", "krypkjeller", "kryperom", "bjelkelag", "tilfarergulv", "påstøp",
    "avretting", "våtromsnormen", "våtsone", "downlights", "rørgjennomføring",
    "rør-i-rør", "fordelerskap", "vannbåren varme", "varmekabel", "flis", "fug",
    "silikonfug", "gips", "sponplate", "osb", "råte", "muggsopp", "svertesopp",
    "saltutslag", "kalkutfelling", "betong", "lettklinker", "leca", "ringmur",
    "radonsperre", "takstein", "undertak", "sutak", "lekt", "sløyfe", "beslag",
    "takrenne", "nedløp", "terrengfall", "kotehøyde", "gradvis", "akutt",
]

# Alt som ikke er bokstav/siffer/whitespace blir mellomrom — også bindestrek,
# så «rør-i-rør» = «rør i rør» (ellers S=1, I=2 på en riktig transkripsjon).
_STRIP_RE = re.compile(r"[^\wæøåÆØÅ\s]", re.UNICODE)

# Måleenheter skrives ulikt av modell og fasit uten at det er en hørefeil.
# Anvendes symmetrisk på begge sider etter tokenisering.
_UNIT_MAP = {
    "mm": "millimeter", "cm": "centimeter",
    "m2": "kvadratmeter", "m²": "kvadratmeter", "kvm": "kvadratmeter",
    "m3": "kubikkmeter", "m³": "kubikkmeter",
}
# Tusenskille («1 500», «1.500») → «1500» på begge sider.
_THOUSANDS_RE = re.compile(r"(?<=\d)[ .  ](?=\d{3}(?!\d))")

# Enhet limt på tallet («15mm», «12m2») skilles ut før tokenisering.
_UNIT_GLUED_RE = re.compile(r"(?<=\d)\s*(mm|cm|m2|m²|m3|m³|kvm)(?![\wæøå])")

_VOWELS = set("aeiouyæøå")


def _term_pattern(term: str) -> str:
    """Grunnform + norsk bøyning: -en/-et/-a/-er/-ene/-ane (sluk → sluket,
    slukene); termer på -e får -n/-a/-r/-ne (dampsperre → dampsperra,
    dampsperren); siste konsonant kan dobles (kryperom → kryperommet).
    Ordgrense foran (svill ≠ bunnsvill) og bak (sluk ≠ slukrist)."""
    if term.endswith("e"):
        # dampsperre → dampsperre/dampsperren/dampsperra/dampsperrer/dampsperrene
        body = re.escape(term[:-1]) + r"(?:e|en|a|er|ene)"
    elif term.endswith("el"):
        # varmekabel → varmekabel/varmekabelen/varmekabler/varmekablene (e faller)
        body = re.escape(term[:-2]) + r"(?:el|elen|ler|lene)"
    else:
        # kryperom → kryperommet: dobling av siste konsonant KUN sammen med et
        # suffiks — «slukk» alene skal fortsatt være en feilstaving av «sluk».
        last = term[-1]
        double = f"{re.escape(last)}?" if last.isalpha() and last not in _VOWELS else ""
        body = re.escape(term) + f"(?:{double}(?:en|et|a|er|ene|ane))?"
    return r"(?<![\wæøå])" + body + r"(?![\wæøå])"


# ── Normalisering og alignment ──────────────────────────────────────────────

def normalize(text: str) -> str:
    t = (text or "").lower().replace("’", "'")
    t = _THOUSANDS_RE.sub("", t)
    t = t.replace("%", " prosent ")
    t = _UNIT_GLUED_RE.sub(r" \1 ", t)
    t = t.replace("m²", " kvadratmeter ").replace("m³", " kubikkmeter ")
    t = _STRIP_RE.sub(" ", t)
    words = [_UNIT_MAP.get(w, w) for w in t.split()]
    return " ".join(words)


def tokens(text: str) -> list[str]:
    n = normalize(text)
    return n.split() if n else []


def align(ref: list[str], hyp: list[str]):
    """Levenshtein på ordnivå med tilbakesporing.
    Returnerer (S, D, I, ops); ops er [(op, ref_ord|None, hyp_ord|None)] med
    op i {'ok','sub','del','ins'} i leserekkefølge."""
    n, m = len(ref), len(hyp)
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        dp[i][0] = i
    for j in range(1, m + 1):
        dp[0][j] = j
    for i in range(1, n + 1):
        ri = ref[i - 1]
        for j in range(1, m + 1):
            c = 0 if ri == hyp[j - 1] else 1
            dp[i][j] = min(dp[i - 1][j - 1] + c, dp[i - 1][j] + 1, dp[i][j - 1] + 1)
    i, j, ops = n, m, []
    while i > 0 or j > 0:
        if i > 0 and j > 0 and dp[i][j] == dp[i - 1][j - 1] + (0 if ref[i - 1] == hyp[j - 1] else 1):
            ops.append(("ok" if ref[i - 1] == hyp[j - 1] else "sub", ref[i - 1], hyp[j - 1]))
            i, j = i - 1, j - 1
        elif i > 0 and dp[i][j] == dp[i - 1][j] + 1:
            ops.append(("del", ref[i - 1], None))
            i -= 1
        else:
            ops.append(("ins", None, hyp[j - 1]))
            j -= 1
    ops.reverse()
    S = sum(1 for o in ops if o[0] == "sub")
    D = sum(1 for o in ops if o[0] == "del")
    I = sum(1 for o in ops if o[0] == "ins")
    return S, D, I, ops


def count_phrase(norm_text: str, term: str) -> int:
    return len(re.findall(_term_pattern(term), norm_text))


def score_clip(ref_text: str, hyp_text: str, fagtermer: list[str], silence: bool = False) -> dict:
    ref, hyp = tokens(ref_text), tokens(hyp_text)
    S, D, I, ops = align(ref, hyp)
    N = len(ref)
    out = {
        "N": N, "S": S, "D": D, "I": I,
        # Stillhetsklipp har per definisjon ingen WER — alt er hallusinert.
        "wer": (S + D + I) / N if (N and not silence) else None,
        "hallucinated": len(hyp) if silence else 0,
        "subs": [(r, h) for op, r, h in ops if op == "sub"],
        "dels": [r for op, r, _ in ops if op == "del"],
        "ins": [h for op, _, h in ops if op == "ins"],
    }
    # Fagtermer: frasebasert gjenfinning (håndterer flerordsuttrykk som
    # «vannbåren varme»). hits = min(forekomster i fasit, i hypotese).
    rn, hn = normalize(ref_text), normalize(hyp_text)
    term_rows = []
    ref_total = hit_total = 0
    for term in fagtermer:
        rc = count_phrase(rn, term)
        if rc == 0:
            continue
        hc = count_phrase(hn, term)
        hits = min(rc, hc)
        ref_total += rc
        hit_total += hits
        term_rows.append({"term": term, "ref": rc, "hits": hits})
    out["fagterm_ref"] = ref_total
    out["fagterm_hits"] = hit_total
    out["fagterm_rows"] = term_rows
    return out


# ── Motorer ─────────────────────────────────────────────────────────────────

_MIME = {
    ".m4a": "audio/mp4", ".mp4": "audio/mp4", ".aac": "audio/aac", ".wav": "audio/wav",
    ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".webm": "audio/webm", ".mov": "video/quicktime",
}


def _post_transcribe(base: str, token: str, audio_path: Path):
    import requests  # allerede i requirements.txt

    mime = _MIME.get(audio_path.suffix.lower(), "audio/mp4")
    with open(audio_path, "rb") as f:
        return requests.post(
            f"{base}/transcribe",
            headers={"x-tester-token": token},
            files={"file": (audio_path.name, f, mime)},
            timeout=180,
        )


def engine_docrai(audio_path: Path, args, silence: bool = False) -> str:
    import time

    base = os.environ.get("DOCRAI_API_URL", "http://localhost:3000").rstrip("/")
    token = os.environ.get("TESTER_TOKEN")
    if not token:
        sys.exit("TESTER_TOKEN må settes (samme tilgangskode som appen bruker).")
    r = _post_transcribe(base, token, audio_path)
    if r.status_code == 429:
        # heavyLimiter: 30 kall/15 min per tester. Vent det API-et ber om, én gang.
        try:
            wait = int(r.json().get("retryAfterSeconds") or r.headers.get("Retry-After") or 60)
        except (ValueError, TypeError):
            wait = 60
        print(f"   429 fra /transcribe — venter {wait} s og prøver én gang til", file=sys.stderr)
        time.sleep(wait)
        r = _post_transcribe(base, token, audio_path)
    if r.status_code == 500 and "No transcription returned" in r.text:
        # Gemini ga tom tekst. API-et skiller ikke «stille» fra «blokkert
        # kandidat» (SAFETY/RECITATION). For et stillhetsklipp er tom tekst
        # den forventede, gyldige hypotesen; for et taleklipp er det en
        # motorfeil som ikke skal caches som 100 % WER.
        if silence:
            return ""
        raise RuntimeError("/transcribe ga tom tekst på taleklipp (blokkert eller stille?) — ikke cachet")
    if r.status_code != 200:
        raise RuntimeError(f"/transcribe {r.status_code}: {r.text[:200]}")
    return r.json().get("text", "")


_ASR = None


def engine_nb_whisper(audio_path: Path, args, silence: bool = False) -> str:
    global _ASR
    try:
        from transformers import pipeline
    except ImportError:
        sys.exit(
            "nb-whisper krever: pip install transformers torch (og ffmpeg på PATH).\n"
            "Modellnavn: sjekk huggingface.co/NbAiLab for gjeldende utgaver."
        )
    if _ASR is None:
        _ASR = pipeline(
            "automatic-speech-recognition",
            model=args.whisper_model,
            chunk_length_s=30,
            return_timestamps=True,
        )
    out = _ASR(str(audio_path), generate_kwargs={"language": "no", "task": "transcribe"})
    return out.get("text", "") if isinstance(out, dict) else str(out)


ENGINES = {"docrai": engine_docrai, "nb-whisper": engine_nb_whisper}


# ── Kjøring ─────────────────────────────────────────────────────────────────

_ID_RE = re.compile(r"[\w-]+(?:\.[\w-]+)*")


def load_manifest(path: Path, engine: str = "file") -> list[dict]:
    """Valideres FØR første API-kall: en skrivefeil skal ikke oppdages etter at
    kvoten er brukt. Id-en blir et filnavn under hyp/<label>/, så den må være
    trygg (ingen «/», ingen «..») og unik (duplikat ville vektet klippet dobbelt).
    Motorer som lytter på lyd krever «audio» på hver oppføring."""
    items = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(items, list) or not items:
        sys.exit("Manifestet må være en ikke-tom JSON-liste.")
    seen = set()
    for it in items:
        if "id" not in it:
            sys.exit(f"Manifest-oppføring mangler 'id': {it}")
        cid = str(it["id"])
        if not _ID_RE.fullmatch(cid):
            sys.exit(f"Ugyldig klipp-id {cid!r}: bruk bokstaver, siffer, punktum, bindestrek, understrek.")
        if cid in seen:
            sys.exit(f"Duplikat klipp-id i manifestet: {cid!r}")
        seen.add(cid)
        if it.get("silence") and str(it.get("reference_text") or "").strip():
            sys.exit(f"{cid}: \"silence\": true krever tom fasit (reference_text).")
        if engine != "file" and not str(it.get("audio") or "").strip():
            sys.exit(f"{cid}: mangler 'audio' (påkrevd for --engine {engine}).")
    return items


def read_reference(item: dict, base: Path) -> str:
    """reference_text vinner når den er ikke-tom; ellers fila i reference."""
    inline = item.get("reference_text")
    if inline is not None and str(inline).strip():
        return str(inline)
    ref = item.get("reference")
    if not ref:
        return str(inline or "")
    return (base / ref).read_text(encoding="utf-8-sig")


def load_fagtermer(path: Path | None) -> list[str]:
    """Én term per linje (fil) eller per element (default). Linjer som starter
    med # er kommentarer. Termene normaliseres som teksten (så «rør-i-rør»
    blir frasen «rør i rør»). Rekkefølgen spiller ingen rolle: count_phrase
    teller hver term uavhengig med ordgrenser — alfabetisk kun for stabil output."""
    if path and path.exists():
        raw = [ln.strip() for ln in path.read_text(encoding="utf-8-sig").splitlines()]
        raw = [ln for ln in raw if ln and not ln.startswith("#")]
    else:
        raw = DEFAULT_FAGTERMER
    terms = {normalize(t) for t in raw}
    return sorted(t for t in terms if t)


def new_totals() -> dict:
    return {"N": 0, "S": 0, "D": 0, "I": 0, "hall": 0, "ft_ref": 0, "ft_hits": 0, "clips_in_wer": 0}


def accumulate(tot: dict, sc: dict, silence: bool) -> None:
    """Stillhetsklipp bidrar KUN til «hall» — aldri til S/D/I/N. Ellers ville
    hallusinerte ord telt dobbelt (som I og som hall), og N=0 ville blåst opp
    total-WER."""
    if silence:
        tot["hall"] += sc["hallucinated"]
        return
    for k in ("N", "S", "D", "I"):
        tot[k] += sc[k]
    tot["ft_ref"] += sc["fagterm_ref"]
    tot["ft_hits"] += sc["fagterm_hits"]
    tot["clips_in_wer"] += 1


def run(args) -> int:
    manifest_path = Path(args.manifest)
    base = manifest_path.parent
    items = load_manifest(manifest_path, engine=args.engine)
    if args.fagtermer and not Path(args.fagtermer).exists():
        # Stille fallback til default-lista ville målt mot feil vokabular.
        sys.exit(f"--fagtermer: fila finnes ikke: {args.fagtermer}")
    term_path = Path(args.fagtermer) if args.fagtermer else base / "fagtermer.txt"
    fagtermer = load_fagtermer(term_path)
    term_source = str(term_path) if term_path.exists() else "innebygd liste"
    label = args.label or args.engine
    hyp_dir = Path(args.hyp_dir) if args.hyp_dir else base / "hyp"
    cache_dir = hyp_dir / label
    cache_dir.mkdir(parents=True, exist_ok=True)

    results, tot = [], new_totals()
    subs, term_misses, skipped = Counter(), Counter(), []
    term_ref, term_hits = Counter(), Counter()   # per-term recall (makro)

    for it in items:
        cid = str(it["id"])
        silence = bool(it.get("silence"))
        try:
            ref = read_reference(it, base)
        except (OSError, UnicodeDecodeError) as e:  # manglende/uleselig (cp1252!) fasitfil skal ikke velte 29 andre
            skipped.append(f"{cid} (fasitfil: {e.__class__.__name__} {it.get('reference')} — må være UTF-8)")
            continue
        if silence and ref.strip():
            skipped.append(f"{cid} (silence=true med ikke-tom fasit)")
            continue
        if not silence and not ref.strip():
            # Tom fasit uten silence-flagg: ville gitt N=0 og alle hyp-ord som I.
            skipped.append(f"{cid} (mangler fasit)")
            continue

        cache = cache_dir / f"{cid}.txt"
        if cache.exists():
            try:
                hyp = cache.read_text(encoding="utf-8-sig")
            except UnicodeDecodeError:
                skipped.append(f"{cid} (hyp/{label}/{cid}.txt er ikke UTF-8 — konverter fila)")
                continue
        elif args.engine == "file":
            skipped.append(f"{cid} (mangler hyp/{label}/{cid}.txt)")
            continue
        else:
            audio = base / it["audio"]
            if not audio.exists():
                skipped.append(f"{cid} (mangler {audio.name})")
                continue
            print(f"… {label}: {cid}", file=sys.stderr)
            try:
                hyp = ENGINES[args.engine](audio, args, silence=silence)
            except Exception as e:  # ett klipp skal ikke velte 29 andre
                msg = str(e).replace("\n", " ")[:120]
                print(f"   FEIL {cid}: {msg}", file=sys.stderr)
                skipped.append(f"{cid} (motorfeil: {msg})")
                continue
            if silence or tokens(hyp):
                cache.write_text(hyp, encoding="utf-8")   # tom tekst caches kun for stillhet

        if not silence and not tokens(hyp):
            # Tom hypotese på taleklipp = N slettinger = 100 % WER, stille.
            # Typisk en gammel tom cache-fil, eller Whisper/Gemini som gir «…».
            skipped.append(f"{cid} (tom hypotese på taleklipp — slett hyp/{label}/{cid}.txt og kjør igjen)")
            continue

        sc = score_clip(ref, hyp, fagtermer, silence=silence)
        sc["id"] = cid
        sc["silence"] = silence
        results.append(sc)
        accumulate(tot, sc, silence)
        if not silence:
            subs.update(sc["subs"])
            for row in sc["fagterm_rows"]:
                term_ref[row["term"]] += row["ref"]
                term_hits[row["term"]] += row["hits"]
                if row["hits"] < row["ref"]:
                    term_misses[row["term"]] += row["ref"] - row["hits"]

    if not results:
        sys.exit("Ingen klipp scoret. " + (f"Hoppet over: {skipped}" if skipped else ""))

    wer = (tot["S"] + tot["D"] + tot["I"]) / tot["N"] if tot["N"] else None
    ft_recall = tot["ft_hits"] / tot["ft_ref"] if tot["ft_ref"] else None

    n_sil = len(results) - tot["clips_in_wer"]
    print(f"\n## WER — {label}  ({tot['clips_in_wer']} klipp i WER, {n_sil} stillhetsklipp, fasit {tot['N']} ord; "
          f"{len(fagtermer)} fagtermer fra {term_source})\n")
    if skipped:
        print(f"**Forbehold: {len(skipped)} av {len(items)} klipp er hoppet over — tallene under gjelder ikke hele settet.**\n")
    print("| klipp | N | S | D | I | WER | fagtermer |")
    print("|---|---:|---:|---:|---:|---:|---:|")
    for r in results:
        w = f"{r['wer']:.1%}" if r["wer"] is not None else (f"hall. {r['hallucinated']} ord" if r["hallucinated"] else "—")
        ft = f"{r['fagterm_hits']}/{r['fagterm_ref']}" if r["fagterm_ref"] else "—"
        print(f"| {r['id']} | {r['N']} | {r['S']} | {r['D']} | {r['I']} | {w} | {ft} |")
    if wer is not None:
        print(f"| **totalt** | {tot['N']} | {tot['S']} | {tot['D']} | {tot['I']} | "
              f"**{wer:.1%}** | **{tot['ft_hits']}/{tot['ft_ref']}** |")
    else:
        print("\nTotal-WER er udefinert: ingen taleklipp med fasit ble scoret (kun stillhet).")

    per_term = {t: term_hits[t] / term_ref[t] for t in term_ref if term_ref[t]}
    macro = sum(per_term.values()) / len(per_term) if per_term else None
    if ft_recall is not None:
        print(f"\nFagterm-gjenfinning: **{ft_recall:.1%}** forekomstvektet "
              f"(feilrate på fagord: {1 - ft_recall:.1%}); makro over {len(per_term)} termer: **{macro:.1%}**")
    if tot["hall"]:
        print(f"Hallusinerte ord på stillhetsklipp: **{tot['hall']}**  ← politiets «tulle-tekst»")
    if per_term:
        print("\nRecall per fagterm (lavest først):")
        print("| term | funnet/i fasit | recall |")
        print("|---|---:|---:|")
        for term in sorted(per_term, key=lambda t: (per_term[t], -term_ref[t], t)):
            print(f"| {term} | {term_hits[term]}/{term_ref[term]} | {per_term[term]:.0%} |")
    if term_misses:
        print("\nFagtermer som gikk tapt (term: antall):")
        for term, n in term_misses.most_common(20):
            print(f"  - {term}: {n}")
    if subs:
        print("\nVanligste forvekslinger (fasit → hypotese):")
        for (r, h), n in subs.most_common(15):
            print(f"  - {r} → {h}  ×{n}")
    if skipped:
        print(f"\nHoppet over: {', '.join(skipped)}")

    out = Path(args.out) if args.out else base / f"results-{label}.json"
    out.write_text(json.dumps({
        "label": label, "wer": wer, "fagterm_recall": ft_recall, "fagterm_recall_macro": macro,
        "clips_total": len(items), "clips_scored": len(results), "skipped_count": len(skipped),
        "fagtermer_source": term_source, "fagtermer_count": len(fagtermer),
        "fagterm_per_term": {t: {"ref": term_ref[t], "hits": term_hits[t], "recall": per_term[t]} for t in per_term},
        "totals": tot, "clips": results, "skipped": skipped,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nSkrevet: {out}")
    # Exit 2 = «resultat, men ikke hele settet»: et skript/CI-steg skal ikke
    # kunne lese et WER på 2 av 30 klipp som om det var alle 30.
    return 2 if skipped else 0


# ── --init og --selftest ────────────────────────────────────────────────────

def init_dir(path: Path) -> None:
    for sub in ("clips", "refs", "hyp"):
        (path / sub).mkdir(parents=True, exist_ok=True)
    (path / "fagtermer.txt").write_text(
        "# Én term per linje (flerordsuttrykk på egen linje). Legg til foretakets\n"
        "# egne produktnavn og lokale ord. Se docs/taleteknologi-laerdommer.md.\n"
        + "\n".join(t for t in load_fagtermer(None)) + "\n",
        encoding="utf-8",
    )
    example = [
        {"id": "kjeller-01", "audio": "clips/kjeller-01.m4a", "reference": "refs/kjeller-01.txt",
         "note": "dialekt + romklang: fuktmåling med verdi, sluk/klemring"},
        {"id": "rask-tale-01", "audio": "clips/rask-tale-01.m4a", "reference": "refs/rask-tale-01.txt",
         "note": "politiets «hull i teksten» — takstperson i flyt"},
        {"id": "stillhet-01", "audio": "clips/stillhet-01.m4a", "reference_text": "", "silence": True,
         "note": "30 s fottrinn og måling — alt som kommer ut er hallusinert"},
    ]
    (path / "manifest.example.json").write_text(
        json.dumps(example, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Opprettet {path}/ med clips/, refs/, hyp/, fagtermer.txt og manifest.example.json.\n"
          f"Neste: legg 20–30 klipp i clips/, skriv fasit i refs/, kopier manifest.example.json → manifest.json.")


def selftest() -> int:
    ft = load_fagtermer(None)
    checks = []

    r = score_clip("sluk klemring membran", "sluk klemmering membran", ft)
    checks.append(("substitusjon på fagord", r["S"] == 1 and r["D"] == 0 and r["I"] == 0 and abs(r["wer"] - 1 / 3) < 1e-9
                   and r["fagterm_ref"] == 3 and r["fagterm_hits"] == 2))

    r = score_clip("ja", "ja ja", ft)
    checks.append(("politiets «Ja. Ja.» = innsetting", r["I"] == 1 and r["wer"] == 1.0))

    r = score_clip("", "takk for at du så på", ft, silence=True)
    checks.append(("hallusinasjon på stillhet", r["wer"] is None and r["hallucinated"] == 6))

    r = score_clip("Fukt 18 prosent ved bunnsvill.", "fukt 18 prosent ved bunnsvill", ft)
    checks.append(("identisk etter normalisering", r["wer"] == 0.0 and r["fagterm_hits"] == 1))

    r = score_clip("vannbåren varme i gulvet", "vannbåren varme i golvet", ft)
    checks.append(("flerords-fagterm gjenfunnet, ikke-fagord feilet", r["fagterm_hits"] == 1 and r["S"] == 1))

    r = score_clip("a b c d", "a c d", ft)
    checks.append(("sletting", r["D"] == 1 and r["S"] == 0 and r["I"] == 0))

    r = score_clip("rør-i-rør i fordelerskap", "rør i rør i fordelerskap", ft)
    checks.append(("bindestrek = mellomrom (rør-i-rør)", r["wer"] == 0.0 and r["fagterm_ref"] == 2 and r["fagterm_hits"] == 2))

    r = score_clip("sluk og sluk", "sluk og slukk", ft)
    checks.append(("dobbel fagterm: 2 i fasit, 1 gjenfunnet", r["fagterm_ref"] == 2 and r["fagterm_hits"] == 1 and r["S"] == 1))

    tot = new_totals()
    accumulate(tot, score_clip("fukt 18 prosent", "fukt 18 prosent", ft), silence=False)
    accumulate(tot, score_clip("", "takk for at du så på", ft, silence=True), silence=True)
    checks.append(("stillhet holdes utenfor total-WER", tot["N"] == 3 and tot["I"] == 0 and tot["hall"] == 6 and tot["clips_in_wer"] == 1))

    r = score_clip("sluket i badet og membranen ved klemringen, fugene rundt flisene",
                   "sluket i badet og membranen ved klemmeringen, fugene rundt flisene", ft)
    checks.append(("bøyde fagtermer telles (sluket/membranen/fugene/flisene), klemringen tapt",
                   r["fagterm_ref"] == 5 and r["fagterm_hits"] == 4 and r["S"] == 1))

    r = score_clip("sluk slukrist fug fuge lekt lekter", "sluk slukrist fug fuge lekt lekter", ft)
    checks.append(("suffiks går ikke inn i sammensetninger (slukrist, fuge), men lekter = lekt",
                   {row["term"]: row["ref"] for row in r["fagterm_rows"]} == {"sluk": 1, "fug": 1, "lekt": 2}))

    r = score_clip("fukt 18,5 prosent ved 15 millimeter", "fukt 18,5 % ved 15 mm", ft)
    checks.append(("% og mm normaliseres likt på begge sider", r["wer"] == 0.0))

    r = score_clip("fukt 18,5 prosent ved 15 millimeter på 12 kvadratmeter", "fukt 18,5% ved 15mm på 12m2", ft)
    checks.append(("enheter limt på tallet (18,5%, 15mm, 12m2)", r["wer"] == 0.0))

    r = score_clip("dampsperra sponplata takrenna kryperommet varmekablene fuktskjoldene",
                   "dampsperra sponplata takrenna kryperommet varmekablene fuktskjoldene", ft)
    checks.append(("bøyning av termer på -e, dobbel konsonant og flertall", r["fagterm_ref"] == 6 and r["fagterm_hits"] == 6))

    r = score_clip("dampsperre er punktert", "dampsperra er punktert", ft)
    checks.append(("dampsperre/dampsperra: fagterm gjenfunnet, ordet er en S", r["fagterm_hits"] == 1 and r["S"] == 1))

    r = score_clip("fukt 18 prosent", "fukt 18 prosent", ft, silence=True)
    checks.append(("silence gir alltid wer=None", r["wer"] is None and r["hallucinated"] == 3))

    checks.append(("«…» er en tom hypotese (skal hoppes over i run, ikke bli 100 %)", tokens("…") == [] and tokens("...") == []))

    r = score_clip("1 500 kroner og 12 kvadratmeter og 3 kubikkmeter", "1500 kroner og 12 kvm og 3m3", ft)
    checks.append(("tusenskille, kvm og m3 normaliseres likt", r["wer"] == 0.0))

    ok = True
    for name, passed in checks:
        print(f"  [{'OK' if passed else 'FEIL'}] {name}")
        ok = ok and passed
    print("selftest:", "alt grønt" if ok else "FEIL")
    return 0 if ok else 1


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("manifest", nargs="?", help="manifest.json (se --init)")
    p.add_argument("--engine", choices=["docrai", "nb-whisper", "file"], default="docrai")
    p.add_argument("--label", help="navn på hypotesesettet (default = engine); brukes som hyp/<label>/")
    p.add_argument("--hyp-dir", help="mappe for hypoteser (default <manifest-mappe>/hyp)")
    p.add_argument("--fagtermer", help="fil med fagtermer (default <manifest-mappe>/fagtermer.txt)")
    p.add_argument("--whisper-model", default="NbAiLab/nb-whisper-large",
                   help="HF-modell for --engine nb-whisper (sjekk gjeldende navn hos NbAiLab)")
    p.add_argument("--out", help="JSON-resultatfil (default <manifest-mappe>/results-<label>.json)")
    p.add_argument("--init", metavar="DIR", help="opprett mappestruktur og eksempelfiler")
    p.add_argument("--selftest", action="store_true", help="verifiser WER-regnestykket")
    args = p.parse_args()

    if args.selftest:
        return selftest()
    if args.init:
        init_dir(Path(args.init))
        return 0
    if not args.manifest:
        p.error("oppgi manifest.json, eller bruk --init / --selftest")
    return run(args)


if __name__ == "__main__":
    sys.exit(main())
