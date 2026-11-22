# Spotlight UI kit

Every dashboard page is built from these components and the role tokens in `app/globals.css`.
Don't hand-roll buttons, headers, panels, tables, chips, empty states or modals, and don't add
raw `gray-*`, `white`, hex or `text-[Npx]` classes in new code.

| Need | Use |
| --- | --- |
| Page title + subtitle + actions | `<Page>` wrapper and `<PageHeader title subtitle actions />` |
| A section with a title | `<Panel title description actions count>` (or `<SectionHeader>` inside your own layout) |
| Any button; a link styled as a button | `<Button variant="primary\|secondary\|ghost\|danger" size="sm\|md" pending />`; `buttonClass({...})` on `<Link>` |
| A form field | `<Field label hint error required><Input/Select/Textarea name=… /></Field>`: the label is wired to the control |
| Form-level result | `<FormMessage tone="error\|success">` (announced to screen readers) |
| A table | `<Table caption>` + `<THead><Th/></THead>` + `<TBody><Tr><Td muted nowrap/></Tr></TBody>` |
| An expandable row | `<RowToggle expanded onToggle controls>` in the first cell + `<RowDetail id colSpan>`; never `onClick` on `<tr>` |
| A status chip | `<StatusBadge status="pending_approval" />` (colour from `lib/status.ts`) or `<Badge tone>` |
| A headline number | `<StatTiles><StatTile label value /></StatTiles>` |
| Nothing to show / failed to load | `<EmptyState title description action tone="empty\|error" />` |
| A dialog; a destructive or financial confirmation | `<Modal open onClose title footer>`; `<ConfirmDialog …>` |

Rules (from the design principles): one primary button per view; four status meanings
(neutral, attention, positive, negative); text is `text-fg` or `text-fg-muted` (`text-fg-subtle`
only for placeholders and hints); sizes are `text-label` 12, `text-body` 14, `text-h2` 16, `text-h1` 20;
weights 400/500/600; one radius (`rounded-md`); one page width (`<Page>`).
