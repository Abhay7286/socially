import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";

export default function Home() {
  return (
    <>
      <Show when="signed-out">
        {/* Added mode="modal" for a smoother pop-up experience */}
        <SignInButton mode="modal" />

        {/* Added asChild so Clerk safely passes its handlers to your button */}
        <SignUpButton mode="modal">
          <button className="bg-purple-700 text-white rounded-full font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 cursor-pointer">
            Sign Up
          </button>
        </SignUpButton>
      </Show>

      <Show when="signed-in">
        <UserButton />
      </Show>
    </>
  );
}