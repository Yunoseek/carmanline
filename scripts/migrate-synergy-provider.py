"""Copy only the explicitly authorized DeepSeek key; never print credentials."""
from pathlib import Path
import json, sys
import yaml

try:
    root = Path(__file__).resolve().parents[1]
    source = Path.home() / '.dsh/.credentials.yaml'
    data = yaml.safe_load(source.read_text(encoding='utf-8'))
    key = data.get('refs', {}).get('DEEPSEEK_API_KEY')
    if not isinstance(key, str) or not key.startswith('sk-'):
        raise ValueError('Unsupported credential structure')
    destination = root / '.synergy-local/provider-env.json'
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps({'DEEPSEEK_API_KEY': key}), encoding='utf-8')
    config = root / '.synergy-local/.synergy/config/synergy.d'
    config.mkdir(parents=True, exist_ok=True)
    provider = {'enabled_providers':['deepseek'],'provider':{'deepseek':{'name':'DeepSeek','npm':'@ai-sdk/openai-compatible','options':{'baseURL':'https://api.deepseek.com/v1','apiKey':key},'models':{'deepseek-chat':{'name':'DeepSeek Chat','limit':{'context':128000,'output':8192}}}}}}
    (config / '20-providers.jsonc').write_text(json.dumps(provider), encoding='utf-8')
    (config / '10-models.jsonc').write_text(json.dumps({'model':'deepseek/deepseek-chat','nano_model':'deepseek/deepseek-chat','mini_model':'deepseek/deepseek-chat','mid_model':'deepseek/deepseek-chat'}), encoding='utf-8')
    print('Authorized DeepSeek provider configured locally. Credential output suppressed.')
except Exception:
    print('Provider migration failed; details suppressed to protect credentials.', file=sys.stderr)
    sys.exit(1)
