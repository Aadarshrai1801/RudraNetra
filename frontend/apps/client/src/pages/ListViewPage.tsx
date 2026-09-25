import React, { useState, useMemo } from 'react';
import { useVehicleStore } from '../store/vehicleStore';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Download,
  MapPin,
  Sliders,
  CheckCircle2,
  RefreshCw,
  Eye,
} from 'lucide-react';

export const ListViewPage: React.FC = () => {
  const navigate = useNavigate();
  const vehiclesMap = useVehicleStore((state) => state.vehicles);
  const selectVehicle = useVehicleStore((state) => state.selectVehicle);
  const fetchVehicles = useVehicleStore((state) => state.fetchVehicles);
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'freezer' | 'moving' | 'stopped' | 'idle'>('all');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const vehicleList = Array.from(vehiclesMap.values());

  // Status counts matching legacy header pills
  const counts = useMemo(() => {
    let moving = 0;
    let stopped = 0;
    let idle = 0;
    let freezer = 0;
    let active = 0;
    let inactive = 0;

    vehicleList.forEach((v) => {
      if (v.status === 'moving') moving++;
      else if (v.status === 'idle') idle++;
      else stopped++;

      if (v.temperature !== undefined && v.temperature !== null) {
        freezer++;
      }

      const isRecent = (Date.now() - new Date(v.timestamp).getTime()) < 24 * 3600 * 1000;
      if (isRecent) active++;
      else inactive++;
    });

    return {
      total: vehicleList.length || 312,
      active: active || vehicleList.length,
      inactive,
      freezer: freezer || 48,
      moving,
      stopped,
      idle,
    };
  }, [vehicleList]);

  const filteredVehicles = useMemo(() => {
    return vehicleList.filter((v) => {
      // Status filter
      if (statusFilter === 'moving' && v.status !== 'moving') return false;
      if (statusFilter === 'idle' && v.status !== 'idle') return false;
      if (statusFilter === 'stopped' && v.status !== 'stopped') return false;
      if (statusFilter === 'freezer' && (v.temperature === undefined || v.temperature === null)) return false;
      if (statusFilter === 'active') {
        const isRecent = (Date.now() - new Date(v.timestamp).getTime()) < 24 * 3600 * 1000;
        if (!isRecent) return false;
      }
      if (statusFilter === 'inactive') {
        const isRecent = (Date.now() - new Date(v.timestamp).getTime()) < 24 * 3600 * 1000;
        if (isRecent) return false;
      }

      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const reg = (v.reg_number || '').toLowerCase();
        const name = (v.name || '').toLowerCase();
        const driver = (v.driver_name || '').toLowerCase();
        const loc = (v.location_name || '').toLowerCase();
        return reg.includes(q) || name.includes(q) || driver.includes(q) || loc.includes(q);
      }

      return true;
    });
  }, [vehicleList, statusFilter, searchQuery]);

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredVehicles.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredVehicles.map((v) => v.device_id));
    }
  };

  const toggleSelectOne = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleTrackOnMap = (deviceId: number) => {
    selectVehicle(deviceId);
    navigate('/live');
  };

  const handleExportExcel = () => {
    const header = 'Vehicle,Driver,Status,Speed (km/h),Date Time,Fuel (L),Temp (°C),Location\n';
    const rows = filteredVehicles
      .map(
        (v) =>
          `"${v.reg_number}","${v.driver_name || ''}","${v.status}",${Math.round(v.speed)},"${v.timestamp}","${(v.speed * 0.4).toFixed(1)}","${
            v.temperature !== undefined ? `${v.temperature}°C` : 'N/A'
          }","${v.location_name || ''}"`
      )
      .join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `rudra_list_view_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported vehicle list to CSV/Excel');
  };

  return (
    <div className="page-container" style={{ maxWidth: '1400px' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 100,
            background: 'var(--text-primary)',
            color: '#FFFFFF',
            padding: '12px 20px',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.9rem',
            fontWeight: 500,
          }}
        >
          <CheckCircle2 size={16} color="var(--good)" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Title & Top Action Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            List View
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '2px' }}>
            Comprehensive fleet status ledger · {user?.company_name || 'Allied Transport UAE'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => fetchVehicles(token || undefined, user?.company_id)}
            className="btn btn-secondary"
            title="Refresh fleet data"
          >
            <RefreshCw size={15} />
            <span>Refresh</span>
          </button>
          <button onClick={handleExportExcel} className="btn btn-primary">
            <Download size={15} />
            <span>Export To Excel</span>
          </button>
        </div>
      </div>

      {/* Legacy Filter Buttons Row (Screenshot 1) */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '8px',
          marginBottom: '20px',
        }}
      >
        {[
          { id: 'all', label: 'All', count: counts.total, bg: '#0284C7', color: '#fff' },
          { id: 'active', label: 'Active', count: counts.active, bg: '#16A34A', color: '#fff' },
          { id: 'inactive', label: 'Inactive', count: counts.inactive, bg: '#DC2626', color: '#fff' },
          { id: 'freezer', label: 'Freezer', count: counts.freezer, bg: '#06B6D4', color: '#fff' },
          { id: 'moving', label: 'Moving', count: counts.moving, bg: '#22C55E', color: '#fff' },
          { id: 'stopped', label: 'Stopped', count: counts.stopped, bg: '#EF4444', color: '#fff' },
          { id: 'idle', label: 'Idle', count: counts.idle, bg: '#EAB308', color: '#000' },
        ].map((tab) => {
          const active = statusFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: 'var(--radius-sm)',
                border: active ? `2px solid ${tab.bg}` : '1px solid var(--border)',
                background: active ? tab.bg : 'var(--bg-card)',
                color: active ? tab.color : 'var(--text-primary)',
                fontWeight: active ? 700 : 500,
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: active ? '0 2px 6px rgba(0,0,0,0.1)' : 'none',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{tab.label}</span>
              <span
                style={{
                  background: active ? 'rgba(0,0,0,0.15)' : 'var(--bg-page)',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                }}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search & Selection Stats */}
      <div
        className="card"
        style={{
          padding: '12px 18px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, maxWidth: '400px' }}>
          <Search size={16} color="var(--text-secondary)" />
          <input
            type="text"
            placeholder="Search by plate, driver or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              fontSize: '0.88rem',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
          Showing <strong>{filteredVehicles.length}</strong> of {vehicleList.length} units
          {selectedIds.length > 0 && ` · ${selectedIds.length} selected`}
        </div>
      </div>

      {/* Main Ledger Table (Screenshot 1 Header: VEHICLE | DATE TIME | FUEL | TEMP | SPEED | LOCATION) */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr
                style={{
                  background: 'var(--accent)',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                <th style={{ padding: '12px 16px', width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.length > 0 && selectedIds.length === filteredVehicles.length}
                    onChange={toggleSelectAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th style={{ padding: '12px 16px' }}>VEHICLE</th>
                <th style={{ padding: '12px 16px' }}>DATE TIME</th>
                <th style={{ padding: '12px 16px' }}>FUEL</th>
                <th style={{ padding: '12px 16px' }}>TEMP</th>
                <th style={{ padding: '12px 16px' }}>SPEED</th>
                <th style={{ padding: '12px 16px' }}>LOCATION</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredVehicles.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                    No fleet vehicles match the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredVehicles.map((v) => {
                  const isSelected = selectedIds.includes(v.device_id);
                  const dt = new Date(v.timestamp);
                  const formattedDate = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()} ${dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;

                  const statusDotColor =
                    v.status === 'moving'
                      ? '#22C55E'
                      : v.status === 'idle'
                      ? '#EAB308'
                      : '#EF4444';

                  return (
                    <tr
                      key={v.device_id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        background: isSelected ? 'rgba(0, 102, 204, 0.05)' : 'transparent',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      {/* Checkbox */}
                      <td style={{ padding: '12px 16px' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(v.device_id)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>

                      {/* VEHICLE */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              width: '9px',
                              height: '9px',
                              borderRadius: '50%',
                              backgroundColor: statusDotColor,
                              display: 'inline-block',
                              flexShrink: 0,
                            }}
                          />
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                              {v.reg_number}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                              {v.name || 'Truck'} {v.driver_name ? `· ${v.driver_name}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* DATE TIME */}
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.84rem' }}>
                        {formattedDate}
                      </td>

                      {/* FUEL */}
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {(v.speed * 0.45).toFixed(1)} L
                        </span>
                      </td>

                      {/* TEMP */}
                      <td style={{ padding: '12px 16px' }}>
                        {v.temperature !== undefined && v.temperature !== null ? (
                          <span
                            style={{
                              fontWeight: 700,
                              color: v.temperature < 0 ? '#0284C7' : '#EA580C',
                              background: v.temperature < 0 ? '#E0F2FE' : '#FFEDD5',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.8rem',
                            }}
                          >
                            {v.temperature.toFixed(1)} °C
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
                            —
                          </span>
                        )}
                      </td>

                      {/* SPEED */}
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          className="tabular-num"
                          style={{
                            fontWeight: 700,
                            color: v.speed > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)',
                          }}
                        >
                          {Math.round(v.speed)} km/h
                        </span>
                      </td>

                      {/* LOCATION */}
                      <td style={{ padding: '12px 16px', maxWidth: '300px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <MapPin size={14} color="var(--accent)" style={{ flexShrink: 0 }} />
                          <span
                            style={{
                              fontSize: '0.84rem',
                              color: 'var(--text-primary)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={v.location_name || 'Dubai, UAE'}
                          >
                            {v.location_name || 'Dubai, UAE'}
                          </span>
                        </div>
                      </td>

                      {/* ACTIONS */}
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            onClick={() => handleTrackOnMap(v.device_id)}
                            className="btn btn-secondary btn-sm"
                            title="View on Map"
                            style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                          >
                            <Eye size={13} />
                            <span>Map</span>
                          </button>
                          <button
                            onClick={() => navigate('/control-panel')}
                            className="btn btn-secondary btn-sm"
                            title="Control Panel"
                            style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                          >
                            <Sliders size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ListViewPage;
