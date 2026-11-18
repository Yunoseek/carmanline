from pathlib import Path
import concurrent.futures, urllib.request, xml.etree.ElementTree as ET, zipfile

ROOT = Path(__file__).resolve().parents[1]
SDK = ROOT / '.tools/android-sdk'
DL = ROOT / '.tools/downloads'

def install(url, key, destination):
    destination.mkdir(parents=True, exist_ok=True)
    archive = DL / url.rsplit('/', 1)[-1]
    if not archive.exists():
        print('Downloading ' + key + ': ' + url, flush=True)
        with urllib.request.urlopen(url, timeout=240) as response, archive.open('wb') as output:
            while chunk := response.read(1024 * 1024):
                output.write(chunk)
    with zipfile.ZipFile(archive) as z:
        for item in z.infolist():
            if not (destination / item.filename).resolve().is_relative_to(destination.resolve()):
                raise ValueError('Archive path traversal')
        z.extractall(destination)
    print('Installed ' + key, flush=True)

def get_package(xml_url, wanted, dest):
    with urllib.request.urlopen(xml_url, timeout=60) as r:
        xml = ET.fromstring(r.read())
    for package in xml.findall('remotePackage'):
        if package.attrib.get('path') != wanted:
            continue
        for archive in package.findall('archives/archive'):
            if archive.findtext('host-os') not in (None, 'windows'):
                continue
            path = archive.findtext('complete/url')
            base = xml_url.rsplit('/', 1)[0] + '/'
            print(wanted + ' size: ' + str(round(int(archive.findtext('complete/size')) / 1024**2)) + ' MiB', flush=True)
            install(base + path, wanted, dest)
            return
    raise RuntimeError('Package not found: ' + wanted)

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    futures = [
        pool.submit(get_package, 'https://dl.google.com/android/repository/repository2-1.xml', 'emulator', SDK),
        pool.submit(get_package, 'https://dl.google.com/android/repository/sys-img/android/sys-img2-1.xml', 'system-images;android-30;default;x86_64', SDK / 'system-images/android-30/default'),
    ]
    for future in futures:
        future.result()
