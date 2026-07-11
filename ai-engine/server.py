import os
import tempfile
import requests
from urllib.parse import urlparse
from fastapi import FastAPI, Request, HTTPException
from pydantic import BaseModel
from main import create_report
from google_api import connect_to_google_api_personal, download_knowledge_from_drive

app = FastAPI()

class ReportRequest(BaseModel):
    video_url: str          # Full URL to the inspector's uploaded video (includes auth token)
    report_meta: dict = {}  # Per-project metadata for template replacements

TEMP_KNOWLEDGE_DIR = "./temp_knowledge"
TEMP_VIDEO_DIR = "./videos"


def _validate_video_url(video_url: str) -> None:
    """
    Reject URLs that don't point to the expected media storage endpoint.
    Prevents SSRF: only allow HTTPS (or HTTP in local dev) URLs whose path
    matches /api/media/<id> and whose host matches API_BASE_URL when set.
    """
    parsed = urlparse(video_url)

    # Must be http or https
    if parsed.scheme not in ("http", "https"):
        raise ValueError(f"Invalid URL scheme '{parsed.scheme}' — only http/https allowed")

    # Path must match /api/media/<something>
    path_parts = parsed.path.strip("/").split("/")
    if len(path_parts) < 3 or path_parts[0] != "api" or path_parts[1] != "media":
        raise ValueError(
            f"URL path '{parsed.path}' does not match expected /api/media/<id> pattern"
        )

    # If API_BASE_URL is set, enforce the host matches
    api_base = os.getenv("API_BASE_URL", "").rstrip("/")
    if api_base:
        expected = urlparse(api_base)
        if parsed.netloc != expected.netloc:
            raise ValueError(
                f"URL host '{parsed.netloc}' does not match configured API host '{expected.netloc}'"
            )


def download_video_from_url(video_url: str, local_dir: str) -> str:
    """
    Downloads a video from the app's media storage endpoint to a local temp
    directory.  Uses an atomic write (temp file + rename) so concurrent calls
    for the same media ID never read a half-written file.
    Returns the local file path.
    """
    _validate_video_url(video_url)

    if not os.path.exists(local_dir):
        os.makedirs(local_dir)

    # Stable cache key: last path segment of the URL (media UUID), no query string
    url_path = video_url.split("?")[0]
    media_id = url_path.rstrip("/").split("/")[-1]
    local_path = os.path.join(local_dir, media_id)

    # Cache hit — only valid after a complete atomic write
    if os.path.exists(local_path):
        print(f"✅ Video already cached locally: {local_path}")
        return local_path

    print(f"📥 Downloading video from media storage: {url_path} ...")
    response = requests.get(video_url, stream=True, timeout=120)
    if response.status_code == 404:
        raise FileNotFoundError(f"Media not found on server (404): {url_path}")
    if response.status_code == 401:
        raise PermissionError("Unauthorized when fetching video from media storage (401)")
    response.raise_for_status()

    # Write to a temp file in the same directory, then atomically rename so a
    # concurrent reader never sees a partial file.
    fd, tmp_path = tempfile.mkstemp(dir=local_dir)
    try:
        with os.fdopen(fd, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        os.replace(tmp_path, local_path)   # atomic on POSIX; overwrites on Windows
    except Exception:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise

    print(f"✅ Video saved to: {local_path}")
    return local_path


@app.post("/api/report")
async def run_analysis(fastapi_req: Request, request: ReportRequest):
    client_token = fastapi_req.headers.get("x-tester-token")
    server_token = os.getenv("TESTER_TOKEN")

    if client_token != server_token:
        print(f"🚫 Rejected request: wrong token")
        raise HTTPException(status_code=401, detail="Unauthorized")

    if not request.video_url:
        raise HTTPException(status_code=400, detail="video_url is required")

    try:
        docs_service, drive_service = connect_to_google_api_personal()
    except EnvironmentError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Failed to connect to Google API: {str(e)}")

    # 1. Download reference knowledge base (PDFs) from Google Drive
    knowledge_id = os.getenv("KNOWLEDGE_FOLDER")
    if knowledge_id:
        download_knowledge_from_drive(drive_service, knowledge_id, TEMP_KNOWLEDGE_DIR)

    # 2. Download the inspector's actual uploaded video from the app's media storage
    try:
        video_path = download_video_from_url(request.video_url, TEMP_VIDEO_DIR)
    except (ValueError, FileNotFoundError, PermissionError) as e:
        return {"status": "error", "message": str(e)}
    except Exception as e:
        return {"status": "error", "message": f"Failed to download video: {str(e)}"}

    # 3. Run the analysis pipeline
    try:
        doc_id = create_report(
            video_path=video_path,
            master_id=os.getenv("MASTER_ID"),
            output_folder=os.getenv("OUTPUT_FOLDER"),
            gemini_key=os.getenv("GEMINI_API_KEY"),
            report_meta=request.report_meta,
        )
        report_url = f"https://docs.google.com/document/d/{doc_id}"
        return {"status": "success", "url": report_url}
    except Exception as e:
        print(f"❌ Error during analysis: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}
