from pathlib import Path
import zipfile
root = Path(__file__).resolve().parents[1]
build = root / 'build/android'
with zipfile.ZipFile(build / 'base.apk') as source, zipfile.ZipFile(build / 'unsigned.apk', 'w') as output:
    for item in source.infolist():
        output.writestr(item, source.read(item.filename))
    for file in (build / 'dex').glob('*.dex'):
        output.write(file, file.name)
