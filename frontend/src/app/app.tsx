import { BrowserRouter } from "react-router"

import { AppRouter } from "@/app/router/app-router"

export function App() {
  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  )
}
