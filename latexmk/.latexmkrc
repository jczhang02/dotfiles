$pdf_mode = 1;                              # tex -> pdf
# $pdf_mode = 2;                            # tex -> ps -> pdf
# $pdf_mode = 5;                            # use xelatex, see `man latexmk`

$pdflatex = 'pdflatex --shell-escape -interaction=nonstopmode -synctex=1 %O %S';
$xelatex = 'xelatex -no-pdf --shell-escape -interaction=nonstopmode -synctex=1 %O %S';
$out_dir = 'build';
