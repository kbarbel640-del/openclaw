let runtime: any = null;

export function setMatrixRuntime(next: any) {
  runtime = next;
}

export function getMatrixRuntime(): any {
  if (!runtime) {
    throw new Error("Matrix runtime not initialized");
  }
  return runtime;
}
