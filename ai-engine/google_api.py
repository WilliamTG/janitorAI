import os
from google.oauth2 import service_account
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request

SCOPES = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/documents'
]

def connect_to_google_api(credentials_path):
    """Initializes and returns the Docs and Drive services."""
    creds = service_account.Credentials.from_service_account_file(
        credentials_path, scopes=SCOPES
    )
    docs_service = build('docs', 'v1', credentials=creds)
    drive_service = build('drive', 'v3', credentials=creds)
    return docs_service, drive_service

def connect_to_google_api_personal(token_path='token.json'):
    creds = None
    
    # 1. Se etter token-filen på den stien vi sender inn
    if os.path.exists(token_path):
        creds = Credentials.from_authorized_user_file(token_path, SCOPES)
    
    # 2. Hvis vi ikke har gyldige credentials
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            print("🔄 Oppdaterer utgått Google-token...")
            creds.refresh(Request())
        else:
            # Starter lokal innlogging (Dette vil bare skje på din Mac, aldri på Render)
            if not os.path.exists('client_secrets.json'):
                raise FileNotFoundError("Fant ikke 'client_secrets.json'. Dette kreves for første gangs innlogging.")
            
            flow = InstalledAppFlow.from_client_secrets_file('client_secrets.json', SCOPES)
            creds = flow.run_local_server(port=0)
        
        # 3. Lagre den nye sessionen (hvis vi har lov)
        try:
            with open(token_path, 'w') as token:
                token.write(creds.to_json())
        except OSError:
            # På Render vil /etc/secrets være read-only. 
            # Det går fint for denne kjøringen, men vi kan ikke lagre filen permanent.
            print(f"⚠️ Advarsel: Kunne ikke skrive til {token_path} (Sannsynligvis Read-Only miljø på Render). Bruker tokenet i minnet for denne forespørselen.")

    return build('docs', 'v1', credentials=creds), build('drive', 'v3', credentials=creds)

def export_doc_as_pdf(drive_service, doc_id):
    """Downloads the Google Doc as a PDF buffer."""
    return drive_service.files().export(
        fileId=doc_id, 
        mimeType='application/pdf'
    ).execute()

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

    # If file already exists locally, skip download
    if os.path.exists(local_path):
        print(f"✅ Video allerede lastet ned: {local_path}")
        return local_path

    # Search for the video file in the Drive folder
    print(f"🔍 Søker etter '{video_filename}' i Google Drive folder {folder_id}...")
    results = drive_service.files().list(
        q=f"'{folder_id}' in parents and name='{video_filename}'",
        fields="files(id, name, mimeType)"
    ).execute()

    files = results.get('files', [])

    if not files:
        raise FileNotFoundError(f"Fant ikke filen '{video_filename}' i Google Drive folder {folder_id}")

    file_id = files[0]['id']
    filename = files[0]['name']

    print(f"📥 Laster ned '{filename}' fra Google Drive...")
    request = drive_service.files().get_media(fileId=file_id)

    with open(local_path, 'wb') as f:
        f.write(request.execute())

    print(f"✅ Video lastet ned til: {local_path}")
    return local_path