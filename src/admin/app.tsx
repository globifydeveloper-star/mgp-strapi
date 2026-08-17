import { getFetchClient, type StrapiApp } from '@strapi/strapi/admin';

export default {
  config: {
    locales: [],
  },
  bootstrap(app: StrapiApp) {
    const contentManager = app.getPlugin('content-manager');
    if (!contentManager) return;

    // Use Strapi's fetch client so cookie-based sessions, persisted sessions,
    // custom backend URLs, and automatic access-token refresh all work.
    const downloadAdminFile = async (endpointPath: string, defaultFilename: string) => {
      try {
        const { data: blob, headers } = await getFetchClient().get(endpointPath, {
          responseType: 'blob',
        });

        const disposition = headers?.get('content-disposition');
        let filename = defaultFilename;
        if (disposition) {
          const encodedMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
          const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
          const responseFilename = encodedMatch?.[1] || plainMatch?.[1];

          if (responseFilename) {
            try {
              filename = decodeURIComponent(responseFilename);
            } catch {
              filename = responseFilename;
            }
          }
        }

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
        alert('Download failed. Please sign in again and retry.');
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

        const handleExport = (e: any) => {
          const type = e.target.value;
          e.target.value = ''; // reset
          if (!type) return;

          if (isJobApp) {
            if (type === 'pdf') downloadAdminFile('/api/job-applications/export/pdf', `Job_Applications_Export_${Date.now()}.pdf`);
            if (type === 'csv') downloadAdminFile('/api/job-applications/export/csv', `Job_Applications_Export_${Date.now()}.csv`);
          } else if (isContactSub) {
            if (type === 'pdf') downloadAdminFile('/api/contact-submissions/export/pdf', `Contact_Submissions_Export_${Date.now()}.pdf`);
            if (type === 'csv') downloadAdminFile('/api/contact-submissions/export/csv', `Contact_Submissions_Export_${Date.now()}.csv`);
          }
        };

        return (
          <select
            onChange={handleExport}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: '#0B1536',
              color: '#FFFFFF',
              border: '1px solid #EBAF20',
              borderRadius: '4px',
              padding: '6px 12px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              marginLeft: '8px',
              outline: 'none',
            }}
          >
            <option value="" style={{ display: 'none' }}>⬇️ Export As...</option>
            <option value="pdf">📄 Export as PDF</option>
            <option value="csv">📊 Export as CSV</option>
          </select>
        );
      },
    });

    // Strapi 5 edit-view side panels receive the current document ID. The
    // legacy editView/right-links injection zone only receives the model slug.
    const contentManagerApis = contentManager.apis as {
      addEditViewSidePanel: (panels: any[]) => void;
    };

    contentManagerApis.addEditViewSidePanel([
      ({ model, document, documentId }: { model: string; document?: any; documentId?: string }) => {
        const isJobApp = model === 'api::job-application.job-application';
        const isContactSub = model === 'api::contact-submission.contact-submission';

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

        return {
          title: 'Downloads',
          content: (
            <div style={{ display: 'flex', width: '100%', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                onClick={handleSinglePdf}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  backgroundColor: '#4945FF',
                  color: '#FFFFFF',
                  border: '1px solid #4945FF',
                  borderRadius: '4px',
                  padding: '8px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Download {isContactSub ? 'contact PDF' : 'application PDF'}
              </button>

              {isJobApp && (
                <button
                  type="button"
                  onClick={handleResumeDownload}
                  disabled={!document?.resume}
                  title={!document?.resume ? 'No resume is attached to this application' : undefined}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    backgroundColor: '#FFFFFF',
                    color: document?.resume ? '#4945FF' : '#8E8EA9',
                    border: `1px solid ${document?.resume ? '#4945FF' : '#DCDCE4'}`,
                    borderRadius: '4px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: document?.resume ? 'pointer' : 'not-allowed',
                  }}
                >
                  Download original resume
                </button>
              )}
            </div>
          ),
        };
      },
    ]);
  },
};
