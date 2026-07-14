import os
import json
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

SCOPES = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/documents'
]


def connect_to_google_api_personal():
    """
    Initializes Docs and Drive services using personal user OAuth2 credentials.

    The token is loaded from the first available source (in priority order):
      1. Render Secret File at /etc/secrets/token.json
      2. Environment variable TOKEN_JSON  (full token JSON as a string)
      3. Local file pointed to by TOKEN_PATH env var (defaults to ./token.json)

    If the access token is expired it is refreshed automatically using the
    refresh token — no user interaction required as long as the refresh token
    is still valid (permanent once the OAuth app is in Production status).
    """
    token_data = None

    # 1. Render Secret File (preferred for production deployments)
    render_secret = "/etc/secrets/token.json"
    if os.path.exists(render_secret):
        with open(render_secret, "r") as f:
            token_data = f.read().strip()
        print("🔑 Loaded OAuth token from Render Secret File")

    # 2. Environment variable containing the full token JSON as a string
    if not token_data:
        token_data = os.environ.get("TOKEN_JSON")
        if token_data:
            print("🔑 Loaded OAuth token from TOKEN_JSON environment variable")

    # 3. Local token.json file (useful for local dev)
    if not token_data:
        token_path = os.environ.get("TOKEN_PATH", "token.json")
        if os.path.exists(token_path):
            with open(token_path, "r") as f:
                token_data = f.read().strip()
            print(f"🔑 Loaded OAuth token from local file: {token_path}")

    if not token_data:
        raise EnvironmentError(
            "Missing OAuth token. Supply it via one of:\n"
            "  • Render Secret File named 'token.json'\n"
            "  • TOKEN_JSON environment variable (full JSON string)\n"
            "  • Local token.json file (or TOKEN_PATH pointing to one)"
        )

    info = json.loads(token_data)
    creds = Credentials.from_authorized_user_info(info, SCOPES)

    # Refresh if the access token has expired (refresh token handles this silently)
    if not creds.valid:
        if creds.expired and creds.refresh_token:
            print("🔄 Access token expired — refreshing...")
            creds.refresh(Request())
            print("✅ Token refreshed successfully")
        else:
            raise EnvironmentError(
                "OAuth token is invalid and cannot be refreshed. "
                "Please supply a fresh token.json."
            )

    docs_service = build('docs', 'v1', credentials=creds)
    drive_service = build('drive', 'v3', credentials=creds)
    return docs_service, drive_service


def export_doc_as_pdf(drive_service, doc_id: str) -> bytes:
    """Downloads the Google Doc as a PDF buffer."""
    return drive_service.files().export(
        fileId=doc_id,
        mimeType='application/pdf'
    ).execute()


def export_doc_as_docx(drive_service, doc_id: str) -> bytes:
    """Downloads the Google Doc as a Word (.docx) buffer."""
    return drive_service.files().export(
        fileId=doc_id,
        mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ).execute()


def share_doc_with_email(drive_service, doc_id: str, email: str, role: str = 'reader') -> None:
    """
    Shares the Google Doc with the given email address.

    role can be 'reader' (view-only) or 'writer' (can edit).
    An email notification is sent automatically by Google Drive.
    """
    permission = {
        'type': 'user',
        'role': role,
        'emailAddress': email,
    }
    drive_service.permissions().create(
        fileId=doc_id,
        body=permission,
        sendNotificationEmail=True,
    ).execute()
    print(f"✅ Shared doc {doc_id} with {email} as {role}")


def upload_knowledge_base(genai_client, folder_path):
    uploaded_files = []
    for filename in os.listdir(folder_path):
        if filename.endswith(".pdf"):
            print(f"📚 Uploading knowledge: {filename}")
            path = os.path.join(folder_path, filename)
            file = genai_client.files.upload(file=path)
            uploaded_files.append(file)
    return uploaded_files


def download_knowledge_from_drive(drive_service, folder_id, local_path):
    if not os.path.exists(local_path):
        os.makedirs(local_path)

    results = drive_service.files().list(
        q=f"'{folder_id}' in parents and mimeType='application/pdf'",
        fields="files(id, name)"
    ).execute()

    files = results.get('files', [])
    for file in files:
        file_id = file['id']
        filename = file['name']

        request = drive_service.files().get_media(fileId=file_id)
        with open(os.path.join(local_path, filename), 'wb') as f:
            f.write(request.execute())


def download_video_from_drive(drive_service, folder_id, video_filename, local_dir):
    """
    Downloads a specific video file from Google Drive folder to local directory.
    Returns the local path if successful, raises exception if file not found.
    """
    if not os.path.exists(local_dir):
        os.makedirs(local_dir)

    local_path = os.path.join(local_dir, video_filename)

    if os.path.exists(local_path):
        print(f"✅ Video already downloaded: {local_path}")
        return local_path

    print(f"🔍 Searching for '{video_filename}' in Drive folder {folder_id}...")
    results = drive_service.files().list(
        q=f"'{folder_id}' in parents and name='{video_filename}'",
        fields="files(id, name, mimeType)"
    ).execute()

    files = results.get('files', [])
    if not files:
        raise FileNotFoundError(
            f"File '{video_filename}' not found in Drive folder {folder_id}"
        )

    file_id = files[0]['id']
    filename = files[0]['name']

    print(f"📥 Downloading '{filename}' from Google Drive...")
    request = drive_service.files().get_media(fileId=file_id)
    with open(local_path, 'wb') as f:
        f.write(request.execute())

    print(f"✅ Video saved to: {local_path}")
    return local_path
