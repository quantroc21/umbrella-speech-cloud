import os
from huggingface_hub import hf_hub_download

def check_and_download_files(repo_id, file_list, local_dir):
    os.makedirs(local_dir, exist_ok=True)
    for file in file_list:
        file_path = os.path.join(local_dir, file)
        if not os.path.exists(file_path):
            print(f"Downloading {file} from {repo_id}...")
            hf_hub_download(
                repo_id=repo_id,
                filename=file,
                resume_download=True,
                local_dir=local_dir,
                local_dir_use_symlinks=False,
            )
        else:
            print(f"{file} exists, skipping.")

# Download Model Checkpoint (The only thing needed for Linux/Docker)
repo_id_1 = "fishaudio/openaudio-s1-mini"
local_dir_1 = "./checkpoints/openaudio-s1-mini"
files_1 = [
    ".gitattributes",
    "model.pth",
    "README.md",
    "special_tokens.json",
    "tokenizer.tiktoken",
    "config.json",
    "codec.pth",
]

check_and_download_files(repo_id_1, files_1, local_dir_1)
