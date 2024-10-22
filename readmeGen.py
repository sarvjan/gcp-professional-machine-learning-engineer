import sys

def generate_readme(max_number, columns=10):
    rows = 10  # Fixed number of rows
    readme_content = "## Questions\n"
    readme_content += "|" + " | ".join([""] * columns) + "|\n"  # Empty row for columns
    readme_content += "|" + " | ".join(["-"] * columns) + "|\n"  # Separator row
    
    # Prepare a matrix with 10 rows and a dynamic number of columns
    matrix = [["" for _ in range(columns)] for _ in range(rows)]
    
    # Fill the matrix by columns first
    for i in range(max_number):
        row = i % rows
        col = i // rows
        matrix[row][col] = f"[question-{i + 1}](./q/question-{i + 1}.pdf)"
    
    # Add each row to the markdown content
    for row in matrix:
        readme_content += "|" + " | ".join(row) + "|\n"

    # Save the README.md file
    with open("README.md", "w") as file:
        file.write(readme_content)

# Example usage:
generate_readme(sys.argv[0])  # Adjust this number to the number of files you have (e.g., 35, 80, 99, etc.)
