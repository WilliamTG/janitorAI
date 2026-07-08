import os
import cv2
import time
import gc
from google import genai
from models import DamageAnalysis
from google_api import connect_to_google_api_personal, upload_knowledge_base
from doc_engine import replace_text_in_doc, upload_and_insert_image
from prompt import system_prompt, main_prompt
from template_replacement import build_replacements

def create_report(video_path, credentials_path, master_id, output_folder, gemini_key, report_meta: dict | None = None):
    # 1. Init Connections
    docs, drive = connect_to_google_api_personal(credentials_path)
    genai_client = genai.Client(api_key=gemini_key)

    # 2. Gemini Analysis (Multimodal)
    print("🤖 Gemini is analyzing video...")
    video_file = genai_client.files.upload(file=video_path)
    while video_file.state.name == "PROCESSING":
        time.sleep(2)
        video_file = genai_client.files.get(name=video_file.name)
    
    current_dir = os.path.dirname(os.path.abspath(__file__))
    knowledge_path = os.path.join(current_dir, "temp_knowledge")
    
    if not os.path.exists(knowledge_path):
        knowledge_path = os.path.join(current_dir, "knowlegde")

    print(f"📚 Opplasting av kunnskapsbase fra: {knowledge_path}")
    knowledge_files = upload_knowledge_base(genai_client, knowledge_path)

    # Add them to your content list
    contents = [video_file] + knowledge_files + [main_prompt()]

    print("🧠 Sending content to Gemini for analysis...")
    analysis = genai_client.models.generate_content(
        model="gemini-2.5-flash",
        contents=contents,
        config={"response_mime_type": "application/json",
                "response_schema": DamageAnalysis,
                "system_instruction": system_prompt(),
                "temperature": 0.0,    # Setter kreativiteten til null
                "top_p": 0.1,         # Velger kun de mest sannsynlige ordene
                "top_k": 1,           # Velger kun det aller beste ordet for hvert steg
                "seed": 42}
    ).parsed

    # Free memory after analysis - contents list can be large
    del contents, knowledge_files, video_file
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

    print(f"✅ Pipeline Complete: https://docs.google.com/document/d/{doc_id}")
    return doc_id