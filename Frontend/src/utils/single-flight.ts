export function createSingleFlight<T>() {
  let pending: Promise<T> | undefined;

  return {
    run(task: () => Promise<T>): Promise<T> {
      if (pending) return pending;
      const next = Promise.resolve().then(task);
      pending = next;
      void next.then(() => {
        if (pending === next) pending = undefined;
      }, () => {
        if (pending === next) pending = undefined;
      });
      return next;
    }
  };
}
