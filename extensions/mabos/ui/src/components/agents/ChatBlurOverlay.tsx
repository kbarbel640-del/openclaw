export function ChatBlurOverlay() {
  return (
    <div
      className="chat-blur-overlay fixed left-0 right-0 bottom-0 h-[120px] z-[20] pointer-events-none"
      aria-hidden="true"
    >
      <div
        className="w-full h-full"
        style={{
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          maskImage: "linear-gradient(to bottom, transparent 0%, black 70%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 70%)",
          willChange: "backdrop-filter",
        }}
      />
    </div>
  );
}
