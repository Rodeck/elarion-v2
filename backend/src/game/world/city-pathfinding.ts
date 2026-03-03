/**
 * Find shortest path between two nodes using BFS on an unweighted graph.
 * @param adjacencyList - Map of nodeId to array of connected nodeIds
 * @param fromNodeId - Starting node
 * @param toNodeId - Target node
 * @returns Array of node IDs from source to destination (inclusive), or null if unreachable
 */
export function findPath(
  adjacencyList: Map<number, number[]>,
  fromNodeId: number,
  toNodeId: number,
): number[] | null {
  if (fromNodeId === toNodeId) return [fromNodeId];
  if (!adjacencyList.has(fromNodeId)) return null;

  const visited = new Set<number>([fromNodeId]);
  const parent = new Map<number, number>();
  const queue: number[] = [fromNodeId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adjacencyList.get(current) ?? [];

    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      parent.set(neighbor, current);

      if (neighbor === toNodeId) {
        const path: number[] = [];
        let node = toNodeId;
        while (node !== fromNodeId) {
          path.push(node);
          node = parent.get(node)!;
        }
        path.push(fromNodeId);
        path.reverse();
        return path;
      }

      queue.push(neighbor);
    }
  }

  return null;
}
