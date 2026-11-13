import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import CampaignApp from './game/ui/CampaignApp';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CampaignApp />
  </StrictMode>,
);
