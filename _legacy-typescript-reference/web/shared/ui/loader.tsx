import Image from "next/image"

export function Loader() {
    return (
        <div className="flex items-center justify-center w-full h-full min-h-[200px]">
            <Image
                src="/icons/icon-192.png"
                alt="Loading..."
                width={60}
                height={60}
                className="animate-pulse"
            />
        </div>
    )
}
