import os

from huggingface_hub import hf_hub_download


# Download
def check_and_download_files(repo_id, file_list, local_dir):
    os.makedirs(local_dir, exist_ok=True)
    for file in file_list:
        file_path = os.path.join(local_dir, file)
        if not os.path.exists(file_path):
            print(f"{file} 不存在，从 Hugging Face 仓库下载...")
            hf_hub_download(
                repo_id=repo_id,
                filename=file,
                resume_download=True,
                local_dir=local_dir,
                local_dir_use_symlinks=False,
            )
        else:
            print(f"{file} 已存在，跳过下载。")


# 1st
repo_id_1 = "fishaudio/fish-speech-1.5"
local_dir_1 = "./checkpoints/fish-speech-1.5"
files_1 = [
    ".gitattributes",
    "model.pth",
    "README.md",
    "special_tokens.json",
    "tokenizer.tiktoken",
    "config.json",
    "firefly-gan-vq-fsq-8x1024-21hz-generator.pth",
]

check_and_download_files(repo_id_1, files_1, local_dir_1)

