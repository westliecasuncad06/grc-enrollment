import { useLocation } from "react-router"

export function LocationProbe() {
  const location = useLocation()

  return (
    <output aria-label="current route">
      {location.pathname}
      {location.search}
    </output>
  )
}
