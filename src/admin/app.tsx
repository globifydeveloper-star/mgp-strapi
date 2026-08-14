import type { StrapiApp } from '@strapi/strapi/admin';

export default {
  config: {
    locales: [],
  },
  bootstrap(app: StrapiApp) {
    const contentManager = app.getPlugin('content-manager');
    if (!contentManager) return;

    // Comprehensive token retriever for Strapi Admin storage keys
    const getAdminToken = (): string => {
      if (typeof window === 'undefined') return '';
      const keys = [
        'jwtToken',
        'strapi_admin_auth',
        'STRAPI_ADMIN_AUTH_TOKEN',
        'admin_jwtToken',
        'token',
        'jwt',
      ];

      for (const storage of [localStorage, sessionStorage]) {
        for (const key of keys) {
          try {
            const raw = storage.getItem(key);
            if (!raw) continue;
            if (raw.startsWith('{') || raw.startsWith('[')) {
              const parsed = JSON.parse(raw);
              const t = parsed?.token || parsed?.jwt || parsed?.jwtToken || (typeof parsed === 'string' ? parsed : null);
              if (t && typeof t === 'string' && t.trim()) return t.trim();
            } else if (typeof raw === 'string' && raw.trim()) {
              return raw.replace(/^"|"$/g, '').trim();
            }
          } catch (_) {}
        }
      }
      return '';
    };

    // Authenticated Blob Download Helper
    const downloadAdminFile = async (endpointPath: string, defaultFilename: string) => {
      const token = getAdminToken();
      const host = window.location.origin;
      const fullUrl = `${host}${endpointPath}`;

      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      try {
        const res = await fetch(fullUrl, {
          method: 'GET',
          headers,
        });

        if (res.status === 403 || res.status === 401) {
          const fallbackToken = token || prompt('Please enter your Strapi Admin API Token:');
          if (fallbackToken) {
            const retryRes = await fetch(`${fullUrl}${fullUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(fallbackToken.trim())}`);
            if (retryRes.ok) {
              const blob = await retryRes.blob();
              const blobUrl = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = blobUrl;
              a.download = defaultFilename;
              document.body.appendChild(a);
              a.click();
              a.remove();
              window.URL.revokeObjectURL(blobUrl);
              return;
            }
          }
          alert('Access Forbidden (403): Admin authentication required. Please re-login to Strapi Admin Panel.');
          return;
        }

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          alert(errData.error || `Download failed with HTTP ${res.status}`);
          return;
        }

        const disposition = res.headers.get('content-disposition');
        let filename = defaultFilename;
        if (disposition && disposition.includes('filename=')) {
          const match = disposition.match(/filename="?([^";]+)"?/);
          if (match && match[1]) filename = match[1];
        }

        const blob = await res.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(blobUrl);
      } catch (err) {
        console.error('[Admin Export] Download error:', err);
        alert('Network error downloading file.');
      }
    };

    // Injection for List View Actions (Top of list view)
    contentManager.injectComponent('listView', 'actions', {
      name: 'pdf-bulk-export-btn',
      Component: () => {
        if (typeof window === 'undefined') return null;
        const path = window.location.pathname;
        const isJobApp = path.includes('job-application');
        const isContactSub = path.includes('contact-submission');

        if (!isJobApp && !isContactSub) {
          return null;
        }

        const handleExport = () => {
          if (isJobApp) {
            downloadAdminFile('/api/job-applications/export/pdf', `Job_Applications_Export_${Date.now()}.pdf`);
          } else if (isContactSub) {
            downloadAdminFile('/api/contact-submissions/export/pdf', `Contact_Submissions_Export_${Date.now()}.pdf`);
          }
        };

        return (
          <button
            type="button"
            onClick={handleExport}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#0B1536',
              color: '#FFFFFF',
              border: '1px solid #EBAF20',
              borderRadius: '4px',
              padding: '6px 12px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              marginLeft: '8px',
            }}
          >
            <span>📄 Export All (PDF)</span>
          </button>
        );
      },
    });

    // Injection for Edit View Right Links (Single Entry Detail Page)
    contentManager.injectComponent('editView', 'right-links', {
      name: 'pdf-single-actions',
      Component: ({ document, documentId }: { document?: any; documentId?: string }) => {
        if (typeof window === 'undefined') return null;
        const path = window.location.pathname;
        const isJobApp = path.includes('job-application');
        const isContactSub = path.includes('contact-submission');

        if (!isJobApp && !isContactSub) {
          return null;
        }

        const docId = documentId || document?.documentId || document?.id;
        if (!docId) return null;

        const handleSinglePdf = () => {
          if (isJobApp) {
            downloadAdminFile(`/api/job-applications/${docId}/pdf`, `Application_${docId}.pdf`);
          } else if (isContactSub) {
            downloadAdminFile(`/api/contact-submissions/${docId}/pdf`, `Contact_Submission_${docId}.pdf`);
          }
        };

        const handleResumeDownload = () => {
          downloadAdminFile(`/api/job-applications/${docId}/resume`, `Resume_${docId}.pdf`);
        };

        return (
          <div
            style={{
              marginTop: '16px',
              padding: '16px',
              backgroundColor: '#FAFAFA',
              border: '1px solid #EAEAEA',
              borderRadius: '4px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#0B1536' }}>
              HR Export Actions
            </h4>
            <button
              type="button"
              onClick={handleSinglePdf}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                backgroundColor: '#0B1536',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '4px',
                padding: '8px 12px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <span>📄 Download {isContactSub ? 'Contact PDF' : 'Application PDF'}</span>
            </button>
            {isJobApp && (
              <button
                type="button"
                onClick={handleResumeDownload}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  backgroundColor: '#FFFFFF',
                  color: '#0B1536',
                  border: '1px solid #0B1536',
                  borderRadius: '4px',
                  padding: '8px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <span>📎 Download Original Resume</span>
              </button>
            )}
          </div>
        );
      },
    });
  },
};
