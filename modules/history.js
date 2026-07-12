export function cloneStrokes(strokes) {
  return strokes.map((stroke) => ({
    ...stroke,
    points: stroke.points.map((point) => ({ ...point })),
  }));
}

export function createHistory({ limit = 20 } = {}) {
  const root = {
    id: 0,
    kind: "root",
    strokes: [],
    parent: null,
    children: [],
  };
  const nodes = new Map([[root.id, root]]);
  const order = [root];
  let current = root;
  let nextId = 1;

  function removeLeaf(node) {
    if (node.parent) {
      node.parent.children = node.parent.children.filter((child) => child !== node);
    }
    nodes.delete(node.id);
    const orderIndex = order.indexOf(node);
    if (orderIndex !== -1) {
      order.splice(orderIndex, 1);
    }
  }

  function trim() {
    const protectedPath = [];
    let pathNode = current;
    while (pathNode) {
      protectedPath.push(pathNode);
      pathNode = pathNode.parent;
    }
    const protectedNodes = new Set(protectedPath.slice(0, limit + 1));

    while (nodes.size > limit + 1) {
      const removableLeaf = order.find(
        (node) => node !== root && !protectedNodes.has(node) && node.children.length === 0,
      );
      if (!removableLeaf) {
        break;
      }
      removeLeaf(removableLeaf);
    }

    if (nodes.size <= limit + 1 || protectedPath.length <= limit + 1) {
      return;
    }

    const newRoot = protectedPath[limit];
    newRoot.parent = null;
    const reachable = new Set();
    const stack = [newRoot];
    while (stack.length) {
      const node = stack.pop();
      if (reachable.has(node)) {
        continue;
      }
      reachable.add(node);
      stack.push(...node.children);
    }
    for (const node of [...order]) {
      if (!reachable.has(node)) {
        nodes.delete(node.id);
        order.splice(order.indexOf(node), 1);
      }
    }
  }

  return {
    get current() {
      return current;
    },

    get canUndo() {
      return current.parent !== null;
    },

    record(kind, strokes) {
      const node = {
        id: nextId,
        kind,
        strokes: cloneStrokes(strokes),
        parent: current,
        children: [],
      };
      nextId += 1;
      current.children.push(node);
      current = node;
      nodes.set(node.id, node);
      order.push(node);
      trim();
      return node;
    },

    undo() {
      if (!current.parent) {
        return null;
      }
      const undoneNode = current;
      current = undoneNode.parent;
      return { undoneNode, targetNode: current };
    },
  };
}
