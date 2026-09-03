import React, { useState, useEffect } from 'react';
import { getFetchClient, type StrapiApp } from '@strapi/strapi/admin';

export default {
  config: {
    locales: [],
  },
  bootstrap(app: StrapiApp) {
    const contentManager = app.getPlugin('content-manager');
    if (!contentManager) return;

    const downloadAdminFile = async (endpointPath: string, defaultFilename: string) => {
      try {
        const { get } = getFetchClient();
        const { data: blob, headers } = await get(endpointPath, { responseType: 'blob' } as any);

        const disposition = (headers as Headers).get?.('content-disposition') ?? '';
        let filename = defaultFilename;
        if (disposition) {
          const encodedMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
          const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
          const raw = encodedMatch?.[1] || plainMatch?.[1];
          if (raw) {
            try { filename = decodeURIComponent(raw); }
            catch { filename = raw; }
          }
        }

        const blobUrl = window.URL.createObjectURL(blob as Blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(blobUrl);
      } catch (err) {
        console.error('[Admin Export] Download error:', err);
        alert('Download failed: ' + String(err));
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
        const isAllLeads = path.includes('all-lead');

        if (!isJobApp && !isContactSub && !isAllLeads) {
          return null;
        }

        // Parse initial date filter values from URL search params
        const getUrlDate = (keys: string[]) => {
          const params = new URLSearchParams(window.location.search);
          for (const key of keys) {
            const val = params.get(key);
            if (val) return val.slice(0, 10);
          }
          return '';
        };

        const initialFrom = getUrlDate([
          'fromDate',
          'from',
          'filters[$and][0][submittedAt][$gte]',
          'filters[submittedAt][$gte]',
        ]);
        const initialTo = getUrlDate([
          'toDate',
          'to',
          'filters[$and][1][submittedAt][$lte]',
          'filters[submittedAt][$lte]',
        ]);

        const [isFilterOpen, setIsFilterOpen] = useState(false);
        const [selectedTab, setSelectedTab] = useState<'date'>('date');
        const [fromDate, setFromDate] = useState(initialFrom);
        const [toDate, setToDate] = useState(initialTo);
        const [appliedFrom, setAppliedFrom] = useState(initialFrom);
        const [appliedTo, setAppliedTo] = useState(initialTo);

        const handleApplyDateFilter = (startVal = fromDate, endVal = toDate) => {
          const params = new URLSearchParams(window.location.search);

          // Clear previous date filter params
          const keysToDelete: string[] = [];
          params.forEach((_, key) => {
            if (
              key.includes('submittedAt') ||
              key === 'fromDate' ||
              key === 'toDate' ||
              key === 'from' ||
              key === 'to'
            ) {
              keysToDelete.push(key);
            }
          });
          keysToDelete.forEach((k) => params.delete(k));

          if (startVal) {
            params.set('filters[$and][0][submittedAt][$gte]', `${startVal}T00:00:00.000Z`);
            params.set('fromDate', startVal);
          }
          if (endVal) {
            params.set('filters[$and][1][submittedAt][$lte]', `${endVal}T23:59:59.999Z`);
            params.set('toDate', endVal);
          }

          params.set('page', '1');
          setAppliedFrom(startVal);
          setAppliedTo(endVal);
          setIsFilterOpen(false);

          window.location.href = `${window.location.pathname}?${params.toString()}`;
        };

        const handleClearFilter = () => {
          const params = new URLSearchParams(window.location.search);
          const keysToDelete: string[] = [];
          params.forEach((_, key) => {
            if (
              key.includes('submittedAt') ||
              key === 'fromDate' ||
              key === 'toDate' ||
              key === 'from' ||
              key === 'to'
            ) {
              keysToDelete.push(key);
            }
          });
          keysToDelete.forEach((k) => params.delete(k));

          setFromDate('');
          setToDate('');
          setAppliedFrom('');
          setAppliedTo('');
          setIsFilterOpen(false);

          window.location.href = `${window.location.pathname}?${params.toString()}`;
        };

        const handleQuickPreset = (preset: 'today' | '7days' | 'thisMonth') => {
          const now = new Date();
          const todayStr = now.toISOString().slice(0, 10);
          let startStr = todayStr;
          let endStr = todayStr;

          if (preset === '7days') {
            const d = new Date();
            d.setDate(d.getDate() - 6);
            startStr = d.toISOString().slice(0, 10);
          } else if (preset === 'thisMonth') {
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            startStr = firstDay.toISOString().slice(0, 10);
          }

          setFromDate(startStr);
          setToDate(endStr);
          handleApplyDateFilter(startStr, endStr);
        };

        const handleExport = (e: any) => {
          const type = e.target.value;
          e.target.value = ''; // reset
          if (!type) return;

          let queryStr = '';
          const activeFrom = appliedFrom || fromDate;
          const activeTo = appliedTo || toDate;
          if (activeFrom || activeTo) {
            const q = new URLSearchParams();
            if (activeFrom) q.set('fromDate', activeFrom);
            if (activeTo) q.set('toDate', activeTo);
            queryStr = `?${q.toString()}`;
          }

          if (isJobApp) {
            if (type === 'pdf') downloadAdminFile(`/api/job-applications/export/pdf${queryStr}`, `Job_Applications_Export_${Date.now()}.pdf`);
            if (type === 'csv') downloadAdminFile(`/api/job-applications/export/csv${queryStr}`, `Job_Applications_Export_${Date.now()}.csv`);
          } else if (isContactSub) {
            if (type === 'pdf') downloadAdminFile(`/api/contact-submissions/export/pdf${queryStr}`, `Contact_Submissions_Export_${Date.now()}.pdf`);
            if (type === 'csv') downloadAdminFile(`/api/contact-submissions/export/csv${queryStr}`, `Contact_Submissions_Export_${Date.now()}.csv`);
          } else if (isAllLeads) {
            if (type === 'pdf') downloadAdminFile(`/api/all-leads/export/pdf${queryStr}`, `All_Leads_Export_${Date.now()}.pdf`);
            if (type === 'csv') downloadAdminFile(`/api/all-leads/export/csv${queryStr}`, `All_Leads_Export_${Date.now()}.csv`);
          }
        };

        const isFiltered = !!(appliedFrom || appliedTo);

        return (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
            {/* Active Filter Indicator Badge */}
            {isFiltered && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#FEF9E7',
                  border: '1px solid #EBAF20',
                  borderRadius: '16px',
                  padding: '4px 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#0B1536',
                }}
              >
                <span>📅 Filtered: {appliedFrom || 'Any'} to {appliedTo || 'Any'}</span>
                <button
                  type="button"
                  onClick={handleClearFilter}
                  title="Clear Date Filter"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#C0392B',
                    fontWeight: 700,
                    fontSize: '14px',
                    cursor: 'pointer',
                    padding: 0,
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              </div>
            )}

            {/* Filter Button */}
            <button
              type="button"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: isFiltered ? '#EBAF20' : '#0B1536',
                color: isFiltered ? '#0B1536' : '#FFFFFF',
                border: '1px solid #EBAF20',
                borderRadius: '4px',
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none',
                boxShadow: isFiltered ? '0 0 8px rgba(235, 175, 32, 0.4)' : 'none',
              }}
            >
              <span>🔍 Filter Options</span>
              <span style={{ fontSize: '10px' }}>{isFilterOpen ? '▲' : '▼'}</span>
            </button>

            {/* Filter Dropdown Popover */}
            {isFilterOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '110%',
                  right: 0,
                  zIndex: 9999,
                  width: '320px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E0E0E0',
                  borderRadius: '8px',
                  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
                  padding: '16px',
                  color: '#333333',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: '#0B1536' }}>
                    Filter Submissions
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsFilterOpen(false)}
                    style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#888' }}
                  >
                    ✕
                  </button>
                </div>

                {/* Filter Option Tab Header */}
                <div style={{ display: 'flex', borderBottom: '1px solid #EEE', marginBottom: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedTab('date')}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      border: 'none',
                      borderBottom: selectedTab === 'date' ? '2px solid #EBAF20' : 'none',
                      backgroundColor: 'transparent',
                      color: selectedTab === 'date' ? '#0B1536' : '#888',
                      cursor: 'pointer',
                    }}
                  >
                    📅 Date Range
                  </button>
                </div>

                {/* Date Option Controls */}
                {selectedTab === 'date' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#555', marginBottom: '4px' }}>
                        From Date
                      </label>
                      <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          fontSize: '12px',
                          border: '1px solid #CCC',
                          borderRadius: '4px',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#555', marginBottom: '4px' }}>
                        To Date
                      </label>
                      <input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          fontSize: '12px',
                          border: '1px solid #CCC',
                          borderRadius: '4px',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    {/* Quick Presets */}
                    <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                      <button
                        type="button"
                        onClick={() => handleQuickPreset('today')}
                        style={{
                          flex: 1,
                          padding: '4px 6px',
                          fontSize: '10px',
                          fontWeight: 600,
                          backgroundColor: '#F4F6F8',
                          border: '1px solid #DDD',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickPreset('7days')}
                        style={{
                          flex: 1,
                          padding: '4px 6px',
                          fontSize: '10px',
                          fontWeight: 600,
                          backgroundColor: '#F4F6F8',
                          border: '1px solid #DDD',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        Last 7 Days
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickPreset('thisMonth')}
                        style={{
                          flex: 1,
                          padding: '4px 6px',
                          fontSize: '10px',
                          fontWeight: 600,
                          backgroundColor: '#F4F6F8',
                          border: '1px solid #DDD',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        This Month
                      </button>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                      <button
                        type="button"
                        onClick={() => handleApplyDateFilter(fromDate, toDate)}
                        style={{
                          flex: 2,
                          backgroundColor: '#0B1536',
                          color: '#FFFFFF',
                          border: '1px solid #EBAF20',
                          borderRadius: '4px',
                          padding: '8px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Apply Date Filter
                      </button>
                      <button
                        type="button"
                        onClick={handleClearFilter}
                        style={{
                          flex: 1,
                          backgroundColor: '#F5F5F5',
                          color: '#555',
                          border: '1px solid #CCC',
                          borderRadius: '4px',
                          padding: '8px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Export Dropdown */}
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
                outline: 'none',
              }}
            >
              <option value="" style={{ display: 'none' }}>⬇️ Export As...</option>
              <option value="pdf">📄 Export as PDF</option>
              <option value="csv">📊 Export as CSV</option>
            </select>
          </div>
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
                Download {isContactSub ? 'Contact Summary (PDF)' : 'Data Summary (PDF)'}
              </button>

              {isJobApp && (
                <button
                  type="button"
                  onClick={handleResumeDownload}
                  disabled={!document?.resume}
                  title={!document?.resume ? 'No CV/Resume was uploaded by this candidate' : undefined}
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
                  Download Uploaded CV/Resume
                </button>
              )}
            </div>
          ),
        };
      },
    ]);
  },
};

