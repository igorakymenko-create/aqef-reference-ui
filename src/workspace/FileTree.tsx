import type { Source } from "./model";
type Branch = { children: Map<string, Branch>; source?: Source };
export function FileTree({
  sources,
  active,
  onChoose,
}: {
  sources: Source[];
  active: string;
  onChoose: (source: Source) => unknown;
}) {
  const root: Branch = { children: new Map() };
  for (const source of sources) {
    let branch = root;
    for (const part of source.path.split("/")) {
      if (!branch.children.has(part))
        branch.children.set(part, { children: new Map() });
      branch = branch.children.get(part)!;
    }
    branch.source = source;
  }
  function level(branch: Branch, depth: number) {
    return (
      <ul role={depth === 1 ? "tree" : "group"}>
        {[...branch.children].map(([name, child]) => (
          <li
            key={name}
            role="treeitem"
            aria-level={depth}
            aria-expanded={child.source ? undefined : true}
            aria-selected={
              child.source ? child.source.path === active : undefined
            }
          >
            {child.source ? (
              <button
                title={child.source.path}
                className={child.source.path === active ? "selected" : ""}
                onClick={() => onChoose(child.source!)}
              >
                {name}
              </button>
            ) : (
              <span className="folder-name">{name}/</span>
            )}
            {child.children.size > 0 && level(child, depth + 1)}
          </li>
        ))}
      </ul>
    );
  }
  return level(root, 1);
}
