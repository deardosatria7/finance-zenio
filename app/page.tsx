import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  TrendingUp,
  Shield,
  Sparkles,
} from "lucide-react";
import CountUp from "@/components/CountUp";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <Wallet className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-semibold text-lg">Finance by Zenio</span>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <Link
                href="#fitur"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Fitur
              </Link>
              <Link
                href="#keamanan"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Keamanan
              </Link>
              <Link
                href="#tentang"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Tentang
              </Link>
            </nav>
            <div className="flex items-center gap-3">
              <Button variant="ghost" asChild className="hidden sm:inline-flex">
                <Link href="/auth">Masuk</Link>
              </Button>
              <Button asChild>
                <Link href="/auth">Mulai</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 md:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted mb-6">
                <Sparkles className="h-3 w-3 text-primary" />
                <span className="text-xs font-medium">
                  Kelola keuangan dengan mudah
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-balance mb-6">
                Manage Keuangan dengan{" "}
                <span className="text-primary">Simple</span>
              </h1>
              <p className="text-lg text-muted-foreground text-pretty mb-8">
                Lacak pemasukan dan pengeluaran Anda dengan mudah. Dashboard
                yang intuitif membantu Anda memahami kondisi keuangan dalam
                sekejap.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" asChild>
                  <Link href="/auth">Mulai Gratis</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="#fitur">Lihat Fitur</Link>
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-6">
                Gratis selamanya. Tidak perlu kartu kredit.
              </p>
            </div>

            {/* Preview Cards */}
            <div className="relative">
              <div className="grid gap-4">
                <Card className="p-6 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-muted-foreground">
                      Total Pemasukan
                    </span>
                    <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
                      <ArrowUpRight className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mb-2">
                    Rp{" "}
                    <CountUp
                      from={0}
                      to={15250000}
                      separator="."
                      direction="up"
                      duration={0.5}
                      className="count-up-text"
                      onStart={undefined}
                      onEnd={undefined}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    24 transaksi bulan ini
                  </div>
                </Card>

                <div className="grid grid-cols-2 gap-4">
                  <Card className="p-4 border-rose-200 dark:border-rose-900">
                    <div className="h-8 w-8 rounded-full bg-rose-100 dark:bg-rose-950 flex items-center justify-center mb-3">
                      <ArrowDownRight className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                    </div>
                    <div className="text-xl font-bold text-rose-600 dark:text-rose-400 mb-1">
                      Rp{" "}
                      <CountUp
                        from={0}
                        to={8500000}
                        separator="."
                        direction="up"
                        duration={0.5}
                        className="count-up-text"
                        onStart={undefined}
                        onEnd={undefined}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Pengeluaran
                    </div>
                  </Card>

                  <Card className="p-4 border-blue-200 dark:border-blue-900 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50">
                    <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center mb-3">
                      <Wallet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="text-xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                      Rp{" "}
                      <CountUp
                        from={0}
                        to={6700000}
                        separator="."
                        direction="up"
                        duration={0.5}
                        className="count-up-text"
                        onStart={undefined}
                        onEnd={undefined}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">Saldo</div>
                  </Card>
                </div>
              </div>

              {/* Decorative blur */}
              <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/20 rounded-full blur-3xl" />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="fitur" className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-balance mb-4">
              Fitur yang Memudahkan
            </h2>
            <p className="text-lg text-muted-foreground text-pretty">
              Semua yang Anda butuhkan untuk mengelola keuangan pribadi dengan
              lebih baik
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">
                Dashboard Interaktif
              </h3>
              <p className="text-muted-foreground text-sm text-pretty">
                Lihat ringkasan keuangan Anda dalam satu tampilan yang mudah
                dipahami dengan visualisasi yang jelas
              </p>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Aman & Terpercaya</h3>
              <p className="text-muted-foreground text-sm text-pretty">
                Data keuangan Anda diamankan dengan enkripsi tingkat bank dan
                perlindungan privasi maksimal
              </p>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Mudah Digunakan</h3>
              <p className="text-muted-foreground text-sm text-pretty">
                Interface yang intuitif membuat pencatatan transaksi menjadi
                cepat dan tidak merepotkan
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20">
            <div className="absolute inset-0 bg-grid-white/10 [mask-image:radial-gradient(white,transparent_70%)]" />
            <div className="relative p-8 md:p-12 text-center max-w-2xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-balance mb-4">
                Mulai Kelola Keuangan Anda Hari Ini
              </h2>
              <p className="text-lg text-muted-foreground text-pretty mb-8">
                Bergabunglah dengan ribuan pengguna yang sudah merasakan
                kemudahan mengelola keuangan pribadi
              </p>
              <Button size="lg" asChild>
                <Link href="/auth">Daftar Sekarang - Gratis</Link>
              </Button>
            </div>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-lg bg-primary flex items-center justify-center">
                <Wallet className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold">Finance by Zenio</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 Finance by Zenio. Kelola keuangan dengan bijak.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
