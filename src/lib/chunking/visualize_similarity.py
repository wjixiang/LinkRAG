import pandas as pd
import matplotlib.pyplot as plt
import argparse
import os

def visualize_similarity(csv_path: str, output_path: str = None, show: bool = False):
    """
    Visualize sentence similarity scores from CSV file as line chart
    
    Args:
        csv_path: Path to input CSV file
        output_path: Optional path to save PNG image (default: same as CSV with .png extension)
        show: Whether to display the plot (default: False)
    """
    # Read CSV data
    df = pd.read_csv(csv_path)
    
    # Create plot
    plt.figure(figsize=(12, 6))
    plt.plot(df['SentencePair'], df['Similarity'], 
             marker='o', linestyle='-', color='b', linewidth=2)
    
    # Customize plot
    plt.title('Sentence Similarity Scores', fontsize=14)
    plt.xlabel('Sentence Pairs', fontsize=12)
    plt.ylabel('Similarity Score', fontsize=12)
    plt.ylim(0, 1)
    plt.grid(True, linestyle='--', alpha=0.7)
    plt.xticks(rotation=45, ha='right')
    plt.tight_layout()
    
    # Save or show plot
    if output_path is None:
        output_path = os.path.splitext(csv_path)[0] + '.png'
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    
    if show:
        plt.show()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Visualize sentence similarity scores')
    parser.add_argument('csv_path', help='Path to input CSV file')
    parser.add_argument('--output', '-o', help='Output PNG path (default: same as CSV with .png extension)')
    parser.add_argument('--show', action='store_true', help='Display the plot')
    args = parser.parse_args()
    
    visualize_similarity(args.csv_path, args.output, args.show)