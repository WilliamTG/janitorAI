import os
from fastapi import FastAPI, Request, HTTPException
from pydantic import BaseModel
from main import create_report
from google_api import connect_to_google_api_personal, download_knowledge_from_drive, download_video_from_drive

app = FastAPI()

class DemoRequest(BaseModel):
    video_filename: str  # This is ignored for demo - we always use the hardcoded demo video

# Stier på serveren
RENDER_TOKEN_PATH = "/etc/secrets/token.json"
LOCAL_TOKEN_PATH = "token.json"
TEMP_KNOWLEDGE_DIR = "./temp_knowledge"
TEMP_VIDEO_DIR = "./videos"
DEMO_VIDEO_FILENAME = "Inspection Video for DEMO.mov"

@app.post("/api/demo-report")
async def run_demo_analysis(fastapi_req: Request, request: DemoRequest):
    client_token = fastapi_req.headers.get("x-tester-token")
    server_token = os.getenv("TESTER_TOKEN")

    if client_token != server_token:
        print(f"🚫 Avviste forespørsel: Feil token ({client_token})")
        raise HTTPException(status_code=401, detail="Unauthorized")

    token_path = RENDER_TOKEN_PATH if os.path.exists(RENDER_TOKEN_PATH) else LOCAL_TOKEN_PATH
    docs_service, drive_service = connect_to_google_api_personal(token_path)

    # 1. Last ned Byggforsk-kunnskap (PDF-er)
    knowledge_id = os.getenv("KNOWLEDGE_FOLDER")
    if knowledge_id:
        download_knowledge_from_drive(drive_service, knowledge_id, TEMP_KNOWLEDGE_DIR)

    # 2. Last ned Demo-videoen fra Google Drive (med caching)
    video_folder_id = os.getenv("VIDEO_FOLDER")
    if not video_folder_id:
        return {"status": "error", "message": "VIDEO_FOLDER environment variable not set"}

    try:
        video_path = download_video_from_drive(
            drive_service=drive_service,
            folder_id=video_folder_id,
            video_filename=DEMO_VIDEO_FILENAME,
            local_dir=TEMP_VIDEO_DIR
        )
    except FileNotFoundError as e:
        return {"status": "error", "message": f"Video file not found: {str(e)}"}
    except Exception as e:
        return {"status": "error", "message": f"Failed to download video: {str(e)}"}

    # 3. Kjør analysen
    try:
        doc_id = create_report(
            video_path=video_path,
            credentials_path=token_path,
            master_id=os.getenv("MASTER_ID"),
            output_folder=os.getenv("OUTPUT_FOLDER"),
            gemini_key=os.getenv("GEMINI_API_KEY")
        )
        report_url = f"https://docs.google.com/document/d/{doc_id}"
        return {"status": "success", "url": report_url}
    except Exception as e:
        print(f"❌ Error during analysis: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}