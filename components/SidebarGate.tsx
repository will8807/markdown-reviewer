'use client'

import { useParams } from 'next/navigation'
import FileTreeSidebar from './FileTreeSidebar'

export default function SidebarGate() {
  const params = useParams()
  if (!params?.sourceId) return null
  return <FileTreeSidebar />
}
