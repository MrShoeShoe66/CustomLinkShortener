import express from 'express';
import { promises as fs } from 'fs';
import basicAuth from 'express-basic-auth';
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const CONFIG_FILE = 'config.json';
const DATA_FILE = 'links.json';

async function loadConfig() {
    try {
        const config = await fs.readFile(CONFIG_FILE, 'utf8');
        return JSON.parse(config);
    } catch {
        const defaultConfig = {
            port: 3000,
            adminDomain: 'admin.example.com',
            adminUsername: 'admin',
            adminPassword: 'password123',
            domains: {
                'short.example.com': {
                    defaultRedirect: 'https://example.com'
                },
                'link.example.com': {
                    defaultRedirect: 'https://example.com/404'
                }
            }
        };
        await fs.writeFile(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
        return defaultConfig;
    }
}

async function loadLinks() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch {
        await fs.writeFile(DATA_FILE, JSON.stringify({}, null, 2));
        return {};
    }
}

async function saveLinks(links) {
    await fs.writeFile(DATA_FILE, JSON.stringify(links, null, 2));
}

async function updateConfig(newConfig) {
    await fs.writeFile(CONFIG_FILE, JSON.stringify(newConfig, null, 2));
}

async function startServer() {
    const config = await loadConfig();
    let links = await loadLinks();

    const authMiddleware = basicAuth({
        users: { [config.adminUsername]: config.adminPassword },
        challenge: true
    });

    app.use('/admin', authMiddleware);

    app.get('/admin', (_req, res) => {
        res.redirect('/admin/links');
    });

    const navBar = `
        <nav>
            <a href="/admin/links">Links</a> |
            <a href="/admin/settings">Settings</a> |
            <a href="/admin/import-export">Import/Export</a> |
            <a href="/admin/domains">Domains</a>
        </nav>
        <hr>
    `;

    app.get('/admin/links', authMiddleware, (_req, res) => {
        const linksHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>Link Management</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .section { margin-bottom: 30px; padding: 20px; border: 1px solid #ddd; }
        .link-item { margin: 10px 0; padding: 10px; border-bottom: 1px solid #eee; }
        input, select, textarea { margin: 5px; padding: 5px; }
        button { margin: 5px; padding: 5px 10px; }
    </style>
</head>
<body>
    ${navBar}
    <div class="section">
        <h2>Link Management</h2>
        <form id="linkForm">
            <div>
                <label>Short Code:</label>
                <input type="text" id="shortCode" required>
            </div>
            <div>
                <label>Target URL:</label>
                <input type="url" id="targetUrl" required>
            </div>
            <div>
                <label>Domain:</label>
                <select id="domain">
                    ${Object.keys(config.domains).map(d => `<option value="${d}">${d}</option>`).join('')}
                </select>
            </div>
            <button type="submit">Save</button>
        </form>

        <h2>Existing Links</h2>
        <div id="linksList"></div>
    </div>

    <script>
    async function loadLinks() {
        try {
            const response = await fetch('/admin/links/export');
            const links = await response.json();
            const list = document.getElementById('linksList');
            list.innerHTML = Object.entries(links)
                .map(([code, data]) => {
                    const safeCode = code.replace(/[<>]/g, '');
                    const safeUrl = data.url.replace(/[<>]/g, '');
                    const safeDomain = data.domain.replace(/[<>]/g, '');
                    return \`
                        <div class="link-item">
                            <strong>\${safeCode}</strong> 
                            (\${safeDomain}): 
                            \${safeUrl}
                            <button onclick="editLink('\${safeCode}', '\${safeUrl}', '\${safeDomain}')">Edit</button>
                            <button onclick="deleteLink('\${safeCode}')">Delete</button>
                        </div>
                    \`;
                })
                .join('');
        } catch (err) {
            console.error('Error loading links:', err);
        }
    }

    function editLink(code, url, domain) {
        document.getElementById('shortCode').value = code;
        document.getElementById('targetUrl').value = url;
        document.getElementById('domain').value = domain;
    }

    async function deleteLink(code) {
        if (confirm('Delete this link?')) {
            try {
                await fetch(\`/admin/links/\${encodeURIComponent(code)}\`, { 
                    method: 'DELETE'
                });
                await loadLinks();
            } catch (err) {
                console.error('Error deleting link:', err);
            }
        }
    }

    document.getElementById('linkForm').onsubmit = async (e) => {
        e.preventDefault();
        try {
            const code = document.getElementById('shortCode').value;
            const url = document.getElementById('targetUrl').value;
            const domain = document.getElementById('domain').value;
            
            const response = await fetch('/admin/links/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, url, domain })
            });

            if (response.ok) {
                document.getElementById('linkForm').reset();
                await loadLinks();
            } else {
                const error = await response.json();
                alert(error.error || 'Error saving link');
            }
        } catch (err) {
            console.error('Error saving link:', err);
            alert('Error saving link');
        }
    };

    loadLinks();
    </script>
</body>
</html>`;
        res.send(linksHtml);
    });

    app.get('/admin/settings', authMiddleware, (_req, res) => {
        const settingsHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>Settings Management</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .section { margin-bottom: 30px; padding: 20px; border: 1px solid #ddd; }
        input, select, textarea { margin: 5px; padding: 5px; }
        button { margin: 5px; padding: 5px 10px; }
        #settingsJson { width: 100%; height: 200px; }
    </style>
</head>
<body>
    ${navBar}
    <div class="section">
        <h2>Settings Management</h2>
        <form id="passwordForm">
            <h3>Change Admin Password</h3>
            <input type="password" id="newPassword" placeholder="New Password" required>
            <button type="submit">Update Password</button>
        </form>
        
        <h3>Export/Import Settings</h3>
        <button onclick="exportSettings()">Export Settings</button>
        <div style="margin-top: 10px;">
            <textarea id="settingsJson" placeholder="Paste settings JSON here"></textarea>
            <button onclick="importSettings()">Import Settings</button>
        </div>
    </div>

    <script>
    async function exportSettings() {
        try {
            const response = await fetch('/admin/settings/export');
            const settings = await response.json();
            document.getElementById('settingsJson').value = JSON.stringify(settings, null, 2);
        } catch (err) {
            console.error('Error exporting settings:', err);
            alert('Error exporting settings');
        }
    }

    async function importSettings() {
        try {
            const settingsJson = document.getElementById('settingsJson').value;
            const settings = JSON.parse(settingsJson);
            
            const response = await fetch('/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });

            if (response.ok) {
                alert('Settings imported successfully. Page will reload.');
                location.reload();
            } else {
                const error = await response.json();
                alert(error.error || 'Error importing settings');
            }
        } catch (err) {
            console.error('Error importing settings:', err);
            alert('Invalid settings JSON');
        }
    }

    document.getElementById('passwordForm').onsubmit = async (e) => {
        e.preventDefault();
        try {
            const newPassword = document.getElementById('newPassword').value;
            
            const response = await fetch('/admin/password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newPassword })
            });

            if (response.ok) {
                alert('Password updated successfully. Please log in again.');
                location.reload();
            } else {
                const error = await response.json();
                alert(error.error || 'Error updating password');
            }
        } catch (err) {
            console.error('Error updating password:', err);
            alert('Error updating password');
        }
    };
    </script>
</body>
</html>`;
        res.send(settingsHtml);
    });

    app.get('/admin/import-export', authMiddleware, (_req, res) => {
        const importExportHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>Import/Export Links</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .section { margin-bottom: 30px; padding: 20px; border: 1px solid #ddd; }
        input, select, textarea { margin: 5px; padding: 5px; }
        button { margin: 5px; padding: 5px 10px; }
        #linksJson { width: 100%; height: 200px; }
    </style>
</head>
<body>
    ${navBar}
    <div class="section">
        <h2>Import/Export Links</h2>
        <button onclick="exportLinks()">Export Links</button>
        <div style="margin-top: 10px;">
            <textarea id="linksJson" placeholder="Paste links JSON here"></textarea>
            <button onclick="importLinks()">Import Links</button>
        </div>
    </div>

    <script>
    async function exportLinks() {
        try {
            const response = await fetch('/admin/links/export');
            const links = await response.json();
            document.getElementById('linksJson').value = JSON.stringify(links, null, 2);
        } catch (err) {
            console.error('Error exporting links:', err);
            alert('Error exporting links');
        }
    }

    async function importLinks() {
        try {
            const linksJson = document.getElementById('linksJson').value;
            const links = JSON.parse(linksJson);
            
            const response = await fetch('/admin/links/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(links)
            });

            if (response.ok) {
                alert('Links imported successfully. Page will reload.');
                location.reload();
            } else {
                const error = await response.json();
                alert(error.error || 'Error importing links');
            }
        } catch (err) {
            console.error('Error importing links:', err);
            alert('Invalid links JSON');
        }
    }
    </script>
</body>
</html>`;
        res.send(importExportHtml);
    });

    // API endpoints
    app.get('/admin/links/export', authMiddleware, (_req, res) => {
        res.json(links);
    });

    app.post('/admin/links', authMiddleware, async (req, res) => {
        const { code, url, domain } = req.body;
        if (!code || !url || !domain) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        if (!config.domains[domain]) {
            return res.status(400).json({ error: 'Invalid domain' });
        }
        links[code] = { url, domain };
        await saveLinks(links);
        res.json({ success: true });
    });

    app.post('/admin/links/import', authMiddleware, async (req, res) => {
        try {
            const newLinks = req.body;
            links = { ...links, ...newLinks };
            await saveLinks(links);
            res.json({ success: true });
        } catch (err) {
            res.status(400).json({ error: 'Invalid links data' });
        }
    });

    app.delete('/admin/links/:code', authMiddleware, async (req, res) => {
        const { code } = req.params;
        delete links[code];
        await saveLinks(links);
        res.json({ success: true });
    });

    app.get('/admin/settings/export', authMiddleware, (_req, res) => {
        res.json(config);
    });

    // Settings endpoints
    app.get('/admin/settings', authMiddleware, (_req, res) => {
        const settings = {
            port: config.port,
            adminDomain: config.adminDomain,
            domains: config.domains
        };
        res.json(settings);
    });

    app.post('/admin/settings', authMiddleware, async (req, res) => {
        try {
            const newSettings = req.body;
            const updatedConfig = {
                ...config,
                ...newSettings,
                adminUsername: config.adminUsername,
                adminPassword: config.adminPassword
            };
            await updateConfig(updatedConfig);
            res.json({ success: true });
        } catch (err) {
            res.status(400).json({ error: 'Invalid settings' });
        }
    });

    app.post('/admin/password', authMiddleware, async (req, res) => {
        try {
            const { newPassword } = req.body;
            if (!newPassword || newPassword.length < 8) {
                return res.status(400).json({ error: 'Password must be at least 8 characters' });
            }
            
            const updatedConfig = {
                ...config,
                adminPassword: newPassword
            };
            await updateConfig(updatedConfig);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: 'Error updating password' });
        }
    });

    // Link redirection
    app.get('/:code', (req, res) => {
        const { code } = req.params;
        const domain = req.get('host');
        const link = links[code];

        if (!link || link.domain !== domain) {
            const domainConfig = config.domains[domain];
            return res.redirect(domainConfig?.defaultRedirect || 'https://example.com');
        }

        res.redirect(link.url);
    });

    app.get('/', (req, res) => {
        const domain = req.get('host');
        const domainConfig = config.domains[domain];
        res.redirect(domainConfig?.defaultRedirect || 'https://example.com');
    });

    app.listen(config.port, () => {
        console.log(`Server running on port ${config.port}`);
    });
}

startServer().catch(console.error);
app.get('/admin/domains', (_req, res) => {
    const domainsHtml = `
<!DOCTYPE html>
<html>
<head>
<title>Domain Management</title>
<style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    .section { margin-bottom: 30px; padding: 20px; border: 1px solid #ddd; }
    input, select, textarea { margin: 5px; padding: 5px; }
    button { margin: 5px; padding: 5px 10px; }
</style>
</head>
<body>
<nav>
            <a href="/admin/links">Links</a> |
            <a href="/admin/settings">Settings</a> |
            <a href="/admin/import-export">Import/Export</a> |
            <a href="/admin/domains">Domains</a>
        </nav>
        <hr>
<div class="section">
    <h2>Domain Management</h2>
    <form id="domainForm">
        <div>
            <label>Domain:</label>
            <input type="text" id="newDomain" required>
        </div>
        <div>
            <label>Default Redirect URL:</label>
            <input type="url" id="defaultRedirect" required>
        </div>
        <button type="submit">Add Domain</button>
    </form>

    <h2>Existing Domains</h2>
    <div id="domainsList"></div>
</div>

<script>
async function loadDomains() {
    try {
        const response = await fetch('/admin/settings/export');
        const settings = await response.json();
        const list = document.getElementById('domainsList');
        list.innerHTML = Object.entries(settings.domains)
            .map(([domain, data]) => {
                const safeDomain = domain.replace(/[<>]/g, '');
                const safeRedirect = data.defaultRedirect.replace(/[<>]/g, '');
                return \`
                    <div class="domain-item">
                        <strong>\${safeDomain}</strong>: 
                        \${safeRedirect}
                        <button onclick="deleteDomain('\${safeDomain}')">Delete</button>
                    </div>
                \`;
            })
            .join('');
    } catch (err) {
        console.error('Error loading domains:', err);
    }
}

async function deleteDomain(domain) {
    if (confirm('Delete this domain?')) {
        try {
            await fetch(\`/admin/domains/\${encodeURIComponent(domain)}\`, { 
                method: 'DELETE'
            });
            await loadDomains();
        } catch (err) {
            console.error('Error deleting domain:', err);
        }
    }
}

document.getElementById('domainForm').onsubmit = async (e) => {
    e.preventDefault();
    try {
        const domain = document.getElementById('newDomain').value;
        const defaultRedirect = document.getElementById('defaultRedirect').value;
        
        const response = await fetch('/admin/domains', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain, defaultRedirect })
        });

        if (response.ok) {
            document.getElementById('domainForm').reset();
            await loadDomains();
        } else {
            const error = await response.json();
            alert(error.error || 'Error adding domain');
        }
    } catch (err) {
        console.error('Error adding domain:', err);
        alert('Error adding domain');
    }
};

loadDomains();
</script>
</body>
</html>`;
    res.send(domainsHtml);
});

app.post('/admin/domains', async (req, res) => {
    const { domain, defaultRedirect } = req.body;
    if (!domain || !defaultRedirect) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    config.domains[domain] = { defaultRedirect };
    await updateConfig(config);
    res.json({ success: true });
});

app.delete('/admin/domains/:domain', async (req, res) => {
    const { domain } = req.params;
    delete config.domains[domain];
    await updateConfig(config);
    res.json({ success: true });
});