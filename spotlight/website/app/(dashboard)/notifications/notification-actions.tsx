'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui'

interface Props {
  employeeId: string
  notificationId?: string
  mode: 'mark-one' | 'mark-all'
}

export default function NotificationActions({ employeeId, notificationId, mode }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleMarkOne = async () => {
    if (!notificationId) return
    setLoading(true)
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
    setLoading(false)
    router.refresh()
  }

  const handleMarkAll = async () => {
    setLoading(true)
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_id', employeeId)
      .eq('is_read', false)
    setLoading(false)
    router.refresh()
  }

  if (mode === 'mark-all') {
    return (
      <Button variant="secondary" onClick={handleMarkAll} pending={loading} pendingLabel="Marking...">
        Mark all as read
      </Button>
    )
  }

  return (
    <Button variant="ghost" size="sm" className="shrink-0" onClick={handleMarkOne} pending={loading} pendingLabel="...">
      Mark read
    </Button>
  )
}
