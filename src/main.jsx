import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { MotionConfig } from 'motion/react'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import './styles/layout.css'
import './styles/site.css'
import './styles/app.css'
import App from './App.jsx'
import { ThemeProvider } from './state/ThemeContext.jsx'
import { ToastProvider } from './state/ToastContext.jsx'
import { AuthProvider } from './state/AuthContext.jsx'
import { DataProvider } from './state/DataContext.jsx'
import { TimerProvider } from './state/TimerContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <DataProvider>
                <TimerProvider>
                  <App />
                </TimerProvider>
              </DataProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </BrowserRouter>
    </MotionConfig>
  </StrictMode>,
)
