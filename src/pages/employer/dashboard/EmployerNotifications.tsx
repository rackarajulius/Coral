import { TooltipProvider } from "@/components/ui/tooltip";
import { NotificationDetailDrawer } from "@/components/employer-dashboard/notifications/NotificationDetailDrawer";
import { NotificationsHeader } from "@/components/employer-dashboard/notifications/NotificationsHeader";
import { NotificationsTabs } from "@/components/employer-dashboard/notifications/NotificationsTabs";
import { BulkActionBar } from "@/components/employer-dashboard/notifications/BulkActionBar";
import { NotificationsFeed } from "@/components/employer-dashboard/notifications/NotificationsFeed";
import { useNotifications } from "@/components/employer-dashboard/notifications/useNotifications";

export default function EmployerNotifications() {
  const {
    tab,
    changeTab,
    query,
    setQuery,
    typeFilters,
    setTypeFilters,
    selected,
    toggleSelected,
    clearSelection,
    selectAllVisible,
    loading,
    hasMore,
    loadingMore,
    sentinelRef,
    drawerOpen,
    setDrawerOpen,
    filtered,
    unreadCount,
    groups,
    allSelected,
    markAllRead,
    markRead,
    archive,
    unarchive,
    remove,
    markSelectedRead,
    openThread,
    activeNotification,
    deliveryFrequency,
    setDeliveryFrequency,
  } = useNotifications();

  return (
    <>
      <TooltipProvider delayDuration={250}>
        <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-10">
          <NotificationsHeader
            unreadCount={unreadCount}
            query={query}
            onQueryChange={setQuery}
            typeFilters={typeFilters}
            onTypeFilterChange={(type, checked) =>
              setTypeFilters((prev) => ({ ...prev, [type]: checked }))
            }
            onMarkAllRead={markAllRead}
            deliveryFrequency={deliveryFrequency}
            onDeliveryFrequencyChange={setDeliveryFrequency}
          />

          <NotificationsTabs tab={tab} unreadCount={unreadCount} onTabChange={changeTab} />

          <BulkActionBar
            selectedCount={selected.size}
            allSelected={allSelected}
            tab={tab}
            onToggleSelectAll={(selectAll) =>
              selectAll ? selectAllVisible() : clearSelection()
            }
            onClearSelection={clearSelection}
            onMarkRead={markSelectedRead}
            onArchive={() => archive(Array.from(selected))}
            onUnarchive={() => unarchive(Array.from(selected))}
            onDelete={() => remove(Array.from(selected))}
          />

          <NotificationsFeed
            tab={tab}
            loading={loading}
            filtered={filtered}
            groups={groups}
            selectedIds={selected}
            hasMore={hasMore}
            loadingMore={loadingMore}
            sentinelRef={sentinelRef}
            onToggleSelect={toggleSelected}
            onMarkRead={(id, read) => markRead([id], read)}
            onArchive={(id) => archive([id])}
            onUnarchive={(id) => unarchive([id])}
            onDelete={(id) => remove([id])}
            onOpen={openThread}
          />
        </div>
      </TooltipProvider>

      <NotificationDetailDrawer
        notification={activeNotification}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onMarkRead={(id, read) => markRead([id], read)}
        onArchive={(id) => archive([id])}
        onUnarchive={(id) => unarchive([id])}
        onDelete={(id) => remove([id])}
      />
    </>
  );
}
