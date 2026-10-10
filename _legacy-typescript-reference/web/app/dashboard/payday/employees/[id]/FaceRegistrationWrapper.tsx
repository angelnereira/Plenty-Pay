'use client';

import dynamic from "next/dynamic";

const FaceRegistrationSection = dynamic(
    () => import("../components/face-registration-section").then((mod) => mod.FaceRegistrationSection),
    { ssr: false }
);

export default FaceRegistrationSection;
