export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-600 border-t-[#1F4D78]" />
    </div>
  );
}
