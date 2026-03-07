import cv2
import time
from google import genai
from .models import DamageAnalysis
from .google_client import connect_to_google_api
from .doc_engine import replace_text_in_doc, upload_and_insert_image

def create_report(video_path, credentials_path, master_id, output_folder, gemini_key):
    # 1. Init Connections
    docs, drive = connect_to_google_api(credentials_path)
    genai_client = genai.Client(api_key=gemini_key)

    # 2. Gemini Analysis (Multimodal)
    print("🤖 Gemini is analyzing video...")
    video_file = genai_client.files.upload(path=video_path)
    while video_file.state.name == "PROCESSING":
        time.sleep(2)
        video_file = genai_client.files.get(name=video_file.name)
    
    analysis = genai_client.models.generate_content(
        model="gemini-2.0-flash",
        contents=[video_file, "Analyser vannskaden. Svar på norsk."],
        config={"response_mime_type": "application/json", "response_schema": DamageAnalysis}
    ).parsed

    # 3. Create Doc Copy
    copy_name = f"Rapport_Skade_{int(time.time())}"
    new_doc = drive.files().copy(fileId=master_id, body={'name': copy_name, 'parents': [output_folder]}).execute()
    doc_id = new_doc['id']

    # 4. Process Evidence Image
    cap = cv2.VideoCapture(video_path)
    cap.set(cv2.CAP_PROP_POS_MSEC, analysis.evidence_timestamp_ms)
    ret, frame = cap.read()
    if ret:
        cv2.imwrite("temp_frame.jpg", frame)
        upload_and_insert_image(drive, docs, doc_id, "temp_frame.jpg", "{{damage.cause.picture}}", output_folder)

    # 5. Final Text Replacement (Gemini + Static)
    replacements = {
        "{{damage.cause.area}}": analysis.area,
        "{{damage.cause.source}}": analysis.source,
        "{{damage.cause.cause}}": analysis.cause,
        "{{damage.cause.description}}": analysis.description,
        # Checkbox logic
        "Beboelighet: {{habitable.is_habitable}}": f"Beboelighet: {'☒ Ja' if analysis.is_habitable else '☐ Ja'} {'☒ Nei' if not analysis.is_habitable else '☐ Nei'}"
    }
    replace_text_in_doc(docs, doc_id, replacements)

    print(f"✅ Pipeline Complete: https://docs.google.com/document/d/{doc_id}")
    return doc_id