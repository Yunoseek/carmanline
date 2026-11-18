"""Create a source archive from an explicit allowlist and scan deliverables."""
from pathlib import Path
import argparse, hashlib, json, re, subprocess, zipfile

parser = argparse.ArgumentParser()
parser.add_argument('--allow-unverified-android', action='store_true', help='Package with an explicit pending Android runtime status; never include an old passing report.')
args = parser.parse_args()

root = Path(__file__).resolve().parents[1]
dist = root / 'dist'
version = json.loads((root / 'package.json').read_text(encoding='utf-8'))['version']
files = [root / p for p in ('README.md', '.gitignore', 'package.json', 'package-lock.json')]
for directory in ('android', 'web', 'scripts', 'tests', 'docs'):
    files.extend(p for p in (root / directory).rglob('*') if p.is_file() and '__pycache__' not in p.parts)
credential_file = root / '.synergy-local/provider-env.json'
secrets = list(json.loads(credential_file.read_text(encoding='utf-8')).values()) if credential_file.exists() else []
for file in files:
    data = file.read_bytes()
    if any(isinstance(secret, str) and secret and secret.encode() in data for secret in secrets):
        raise RuntimeError('Credential scan failed; packaging stopped.')
apk = dist / f'carmanline-v{version}.apk'
with zipfile.ZipFile(apk) as z:
    for name in z.namelist():
        data = z.read(name)
        if any(isinstance(secret, str) and secret and secret.encode() in data for secret in secrets):
            raise RuntimeError('APK credential scan failed; packaging stopped.')
    if 'assets/data.mjs' in z.namelist():
        raise RuntimeError('Legacy sample content must not be packaged into Carmanline.')
    for name in ('index.html', 'core.mjs', 'state.mjs', 'import.mjs', 'duplicates.mjs', 'app.mjs', 'app.bundle.js', 'style.css', 'theme.css'):
        if z.read('assets/' + name) != (root / 'web' / name).read_bytes():
            raise RuntimeError('APK does not match the current sources: ' + name)
digest = hashlib.sha256(apk.read_bytes()).hexdigest()
prefix = 'v' + version.replace('.', '')
web_report_name = f'{prefix}-web-verification.json'
web_data = (dist / web_report_name).read_bytes()
web_report = json.loads(web_data)
if web_report.get('status') != 'passed' or web_report.get('version') != version:
    raise RuntimeError('A current browser verification report is required.')
reports = {web_report_name: web_data}
verification_path = dist / f'{prefix}-android-verification.json'
verification = json.loads(verification_path.read_text(encoding='utf-8')) if verification_path.exists() else {}
android_verified = verification.get('status') == 'passed' and verification.get('version') == version and verification.get('apkSha256') == digest
if not android_verified:
    if not args.allow_unverified_android:
        raise RuntimeError('A passing Android runtime report for the final APK is required. Use --allow-unverified-android to explicitly record this check as pending.')
    verification = {'status':'pending','version':version,'apkSha256':digest,'reason':'No passing Android runtime report for this APK. Local browser checks passed.'}
reports[verification_path.name] = json.dumps(verification, ensure_ascii=False, indent=2).encode('utf-8')
tests = subprocess.run(['node', '--test', '--test-reporter=tap', *map(str, sorted((root / 'tests').glob('*.test.mjs')))], cwd=root, check=True, stdout=subprocess.PIPE)
passed = int(re.search(rb'^# pass (\d+)\s*$', tests.stdout, re.MULTILINE).group(1))
source = dist / f'carmanline-v{version}-source.zip'
with zipfile.ZipFile(source, 'w', zipfile.ZIP_DEFLATED) as z:
    for file in files:
        z.write(file, file.relative_to(root))
    for name, data in reports.items():
        if any(isinstance(secret, str) and secret and secret.encode() in data for secret in secrets):
            raise RuntimeError('Report credential scan failed; packaging stopped.')
        z.writestr('verification/' + name, data)
manifest = {
    'name':'Carmanline', 'version':version, 'apk':apk.name, 'apkBytes':apk.stat().st_size,
    'apkSha256':digest, 'sourceArchive':source.name, 'minimumAndroid':'7.0 / API 24',
    'runtimeVerified':verification.get('platform') if android_verified else None,
    'androidRuntimeStatus':'passed' if android_verified else 'pending', 'credentialScan':'passed',
    'sourceMatchesApk':True, 'unitTestsPassed':passed, 'browserChecks':web_report['checks'],
    'androidChecks':verification.get('checks', []),
}
(dist / 'delivery-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(manifest, ensure_ascii=False))
