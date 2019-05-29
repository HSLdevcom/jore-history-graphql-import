import v8 from "v8";

export function getMemoryStats() {
  const memoryStats = v8.getHeapStatistics();
  const used = Math.abs(memoryStats.used_heap_size / 1024 / 1024);
  const available = Math.abs(memoryStats.heap_size_limit / 1024 / 1024);

  return { available, used };
}
