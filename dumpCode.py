import os

# ===== SETTINGS =====
ROOT_FOLDER = r"."   # Change this to your project folder path if needed
OUTPUT_FILE = "all_code_output.txt"

# Folders to ignore
IGNORE_FOLDERS = {
    "node_modules",
    ".git",
    "__pycache__",
    "dist",
    "build"
}

# Optional: Ignore large/binary file types
IGNORE_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".bmp",
    ".mp4", ".mp3", ".zip", ".exe", ".dll",
    ".pdf", ".ico", ".woff", ".woff2"
}


def is_text_file(file_path):
    """
    Checks if file is readable as text.
    """
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            f.read(1000)
        return True
    except:
        return False


with open(OUTPUT_FILE, "w", encoding="utf-8") as output:

    for root, dirs, files in os.walk(ROOT_FOLDER):

        # Remove ignored folders from traversal
        dirs[:] = [d for d in dirs if d not in IGNORE_FOLDERS]

        for file in files:

            file_path = os.path.join(root, file)

            # Skip ignored extensions
            ext = os.path.splitext(file)[1].lower()
            if ext in IGNORE_EXTENSIONS:
                continue

            # Skip output file itself
            if file == OUTPUT_FILE:
                continue

            # Check if readable text file
            if not is_text_file(file_path):
                continue

            try:
                relative_path = os.path.relpath(file_path, ROOT_FOLDER)

                print(f"Reading: {relative_path}")

                output.write("\n")
                output.write("=" * 80 + "\n")
                output.write(f"FILE: {relative_path}\n")
                output.write("=" * 80 + "\n\n")

                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()

                output.write(content)
                output.write("\n\n")

            except Exception as e:
                print(f"Error reading {file_path}: {e}")

print(f"\nDone! All code saved into: {OUTPUT_FILE}")
