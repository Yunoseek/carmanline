"""Run the installed Synergy CLI and redact credentials from its console output."""
from pathlib import Path
import json, re, subprocess, sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

root = Path(__file__).resolve().parents[1]
args = sys.argv[1:]
capture = None
if args and args[0].startswith('--capture='):
    capture = (root / args.pop(0).split('=', 1)[1]).resolve()
    if not capture.is_relative_to((root / 'dist').resolve()):
        sys.exit('Capture must stay inside dist.')
credential_file = root / '.synergy-local/provider-env.json'
secrets = list(json.loads(credential_file.read_text(encoding='utf-8')).values()) if credential_file.exists() else []
stdin_text = ''
if '--review-code' in args:
    args.remove('--review-code')
    for relative in ('web/core.mjs', 'web/app.mjs', 'tests/core.test.mjs'):
        content = (root / relative).read_text(encoding='utf-8')
        if any(secret and secret in content for secret in secrets):
            sys.exit('Credential check failed; source transmission stopped.')
        stdin_text += '\n\n### ' + relative + '\n```javascript\n' + content + '\n```\n'
process = subprocess.Popen(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', str(root / 'scripts/synergy.ps1'), *args], cwd=root, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, encoding='utf-8', errors='replace')
if stdin_text:
    process.stdin.write(stdin_text)
process.stdin.close()
output = []
for line in process.stdout:
    for secret in secrets:
        if isinstance(secret, str) and secret:
            line = line.replace(secret, '[REDACTED]')
    line = re.sub(r'sk-[A-Za-z0-9_-]+', '[REDACTED]', line)
    output.append(re.sub(r'\x1b\[[0-9;]*m', '', line))
    print(line.rstrip()[:4000], flush=True)
code = process.wait()
if capture and code == 0:
    capture.write_text('# Synergy 调度代码审查\n\n模型：DeepSeek deepseek-chat。范围：用户明确批准的三个新生成源文件。\n\n' + ''.join(output), encoding='utf-8')
sys.exit(code)
