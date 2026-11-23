export function Footer() {
  return (
    <footer className="bg-transparent py-6 text-center text-xs text-gray-500">
      <div className="mx-auto max-w-5xl px-4 space-y-1">
        <p
          className="font-mono font-bold text-gray-800"
          style={{ fontFamily: "'Courier New', Courier, monospace" }}
        >
          <span className="text-blue-600">fatih</span><span className="text-gray-900">working</span><span className="text-red-600">tools</span>
        </p>
        <p className="text-gray-400 text-[11px]">
          &copy; {new Date().getFullYear()} Fatih Tsaqif. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
