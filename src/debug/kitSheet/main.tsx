/**
 * The kit sheet's entry — ticket 183a. Dev only: `kit.html` is not a Vite build input, so it is
 * served by `npm run dev` at `/Mingming/kit.html` and never reaches `dist/`.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '../../index.css';
import { KitSheet } from './KitSheet';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <KitSheet />
    </StrictMode>,
);
