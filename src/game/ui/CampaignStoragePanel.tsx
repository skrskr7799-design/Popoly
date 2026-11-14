import type { ChangeEvent } from 'react';
import { Download, FolderOpen, HardDrive, RefreshCw, Upload } from 'lucide-react';
import type { CampaignSaveSummary } from '../persistence/repository';
import { formatQuarter } from './format';

export function CampaignStoragePanel({
  campaigns, activeCampaignId, busy, onLoad, onExport, onImport, onRefresh,
}: {
  campaigns: CampaignSaveSummary[];
  activeCampaignId: string;
  busy: boolean;
  onLoad: (campaignId: string) => void;
  onExport: (campaignId: string) => void;
  onImport: (file: File | null) => void;
  onRefresh: () => void;
}) {
  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    onImport(event.currentTarget.files?.[0] ?? null);
    event.currentTarget.value = '';
  };

  return <section className="pop-panel pop-storage">
    <div className="pop-section-title">
      <div><span className="pop-eyebrow">CAMPAIGN ARCHIVE</span><h2>Saved campaigns</h2></div>
      <button className="pop-quiet-button" onClick={onRefresh} disabled={busy}><RefreshCw size={14} /> Refresh</button>
    </div>
    <p className="pop-panel-intro">Campaign snapshots are stored locally in this browser. Export a JSON copy to move a campaign to another device.</p>
    <div className="pop-storage-toolbar">
      <label className="pop-secondary-button"><Upload size={14} /> Import JSON
        <input type="file" accept=".json,application/json" onChange={handleImport} disabled={busy} />
      </label>
      <span><HardDrive size={13} /> Local IndexedDB storage</span>
    </div>
    {campaigns.length === 0
      ? <div className="pop-storage-empty"><FolderOpen size={21} /><span>No saved campaigns yet.</span><small>Save the current campaign to create your first snapshot.</small></div>
      : <div className="pop-storage-list">{campaigns.map((campaign) =>
        <div className="pop-storage-row" key={campaign.campaignId}>
          <div className="pop-storage-info">
            <strong>{campaign.campaignId.slice(0, 18)}</strong>
            <span>{formatQuarter(campaign.quarter)} · Updated {new Date(campaign.updatedAt).toLocaleString()}</span>
            {campaign.campaignId === activeCampaignId && <small>Current session</small>}
          </div>
          <div className="pop-storage-actions">
            <button className="pop-quiet-button" onClick={() => onExport(campaign.campaignId)} disabled={busy}><Download size={14} /> Export</button>
            <button className="pop-secondary-button" onClick={() => onLoad(campaign.campaignId)} disabled={busy}>{campaign.campaignId === activeCampaignId ? 'Reload' : 'Load'}</button>
          </div>
        </div>)}</div>}
  </section>;
}
