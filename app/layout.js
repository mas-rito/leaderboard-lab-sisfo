import "./globals.css";

export const metadata = {
  title: "Leaderboard game stand Laboratorium Sistem Informasi",
  description: "Leaderboard berdasarkan Level",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>
        <div className="container">
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
