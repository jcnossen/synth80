set -eu
release=/var/www/synth-releases/20261028-mobile-voice-tracks
site=/etc/nginx/sites-enabled/jcnossen.nl
mkdir -p "$release"
tar -xzf /tmp/synth80-release.tar.gz -C "$release"
test -f "$release/index.html"
test ! -e /var/www/synth
cp "$site" /etc/nginx/sites-enabled-jcnossen.nl.synth-backup-20261028
install -m 644 /tmp/synth80-nginx.conf /etc/nginx/snippets/synth.conf
python3 - <<'PY'
from pathlib import Path
p = Path('/etc/nginx/sites-enabled/jcnossen.nl')
s = p.read_text()
line = '    include /etc/nginx/snippets/synth.conf;'
if line not in s:
    s = s.replace('    server_name jcnossen.nl www.jcnossen.nl;', '    server_name jcnossen.nl www.jcnossen.nl;\n' + line, 1)
    p.write_text(s)
PY
ln -s "$release" /var/www/synth
if nginx -t; then
    systemctl reload nginx
else
    cp /etc/nginx/sites-enabled-jcnossen.nl.synth-backup-20261028 "$site"
    exit 1
fi
curl --fail --silent --output /dev/null --write-out 'HTTPS status: %{http_code}\n' https://jcnossen.nl/synth/
