import { RouterProvider } from './routes'
import { DialogProvider } from './components/dialogs/DialogProvider'

function App() {
  return (
    <DialogProvider>
      <RouterProvider />
    </DialogProvider>
  )
}

export default App
