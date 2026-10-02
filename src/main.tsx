import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource/gloock/400.css'
import '@fontsource-variable/schibsted-grotesk/wght.css'
import '@fontsource-variable/martian-mono/standard.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/shell.css'
import './styles/catalog.css'
import './styles/course.css'
import './styles/player.css'
import './styles/labs.css'
import './styles/pages.css'
import { App } from './App'
import { LearnerProvider } from './store/LearnerProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <LearnerProvider>
        <App />
      </LearnerProvider>
    </BrowserRouter>
  </StrictMode>,
)
