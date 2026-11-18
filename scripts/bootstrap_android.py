"""Install a project-local Android toolchain from official download endpoints."""
from pathlib import Path
import concurrent.futures, hashlib, json, urllib.request, xml.etree.ElementTree as ET, zipfile

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / '.tools'
DOWNLOADS = TOOLS / 'downloads'
DOWNLOADS.mkdir(parents=True, exist_ok=True)

def read(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'FormulaRecallDemo/0.1'})
    with urllib.request.urlopen(req, timeout=90) as r:
        return r.read()

def unpack(url, dest, checksum=None, algorithm='sha256'):
    archive = DOWNLOADS / url.rsplit('/', 1)[-1]
    if not archive.exists():
        print('Downloading ' + url, flush=True)
        archive.write_bytes(read(url))
    if checksum:
        actual = hashlib.new(algorithm, archive.read_bytes()).hexdigest()
        if actual != checksum:
            raise RuntimeError('Checksum mismatch: ' + str(archive))
    dest.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive) as z:
        for item in z.infolist():
            target = (dest / item.filename).resolve()
            if not target.is_relative_to(dest.resolve()):
                raise RuntimeError('Archive path escaped installation directory')
        z.extractall(dest)
    print('Installed ' + str(dest), flush=True)

def install_jdk():
    if list((TOOLS / 'jdk').glob('*/bin/javac.exe')):
        return
    data = json.loads(read('https://api.adoptium.net/v3/assets/latest/17/hotspot?architecture=x64&image_type=jdk&os=windows&vendor=eclipse'))
    package = data[0]['binary']['package']
    unpack(package['link'], TOOLS / 'jdk', package['checksum'])

def install_android():
    xml = ET.fromstring(read('https://dl.google.com/android/repository/repository2-1.xml'))
    wanted = {'build-tools;35.0.0': 'build-tools/35.0.0', 'platforms;android-35': 'platforms/android-35', 'platform-tools': ''}
    jobs = []
    scheduled = set()
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for package in xml.findall('remotePackage'):
            key = package.attrib.get('path')
            if key not in wanted or key in scheduled:
                continue
            scheduled.add(key)
            dest = TOOLS / 'android-sdk' / wanted[key]
            check = dest / ('aapt2.exe' if key.startswith('build-tools') else 'android.jar' if key.startswith('platforms;') else 'platform-tools/adb.exe')
            if check.exists():
                continue
            for archive in package.findall('archives/archive'):
                host = archive.findtext('host-os')
                if host not in (None, 'windows'):
                    continue
                complete = archive.find('complete')
                checksum = complete.find('checksum')
                jobs.append((pool.submit(unpack, 'https://dl.google.com/android/repository/' + complete.findtext('url'), dest, checksum.text, checksum.attrib.get('type', 'sha1')), key, dest))
                break
        for future, key, dest in jobs:
            future.result()
            # Google archives contain one package root; normalize to SDK layout.
            if key != 'platform-tools':
                folders = [p for p in dest.iterdir() if p.is_dir()]
                expected = 'aapt2.exe' if key.startswith('build-tools') else 'android.jar'
                if not (dest / expected).exists() and len(folders) == 1:
                    for child in folders[0].iterdir():
                        child.rename(dest / child.name)
                    folders[0].rmdir()

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    futures = [pool.submit(install_jdk), pool.submit(install_android)]
    for future in futures:
        future.result()
print('Android toolchain ready.', flush=True)
