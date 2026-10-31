import { useEffect, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { yaml } from "@codemirror/lang-yaml";

export function YamlEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (text: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    editor = useRef<EditorView>(null),
    changed = useRef(onChange);
  changed.current = onChange;
  useEffect(() => {
    const view = new EditorView({
      parent: host.current!,
      doc: value,
      extensions: [
        basicSetup,
        yaml(),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({
          "aria-label": "YAML editor",
          "data-testid": "yaml-editor",
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) changed.current(update.state.doc.toString());
        }),
      ],
    });
    editor.current = view;
    return () => {
      view.destroy();
      editor.current = null;
    };
  }, []);
  useEffect(() => {
    const view = editor.current;
    if (view && view.state.doc.toString() !== value)
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
      });
  }, [value]);
  return <div ref={host} className="yaml-editor" />;
}
